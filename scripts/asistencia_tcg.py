#!/usr/bin/env python3
"""
Asistencia de Transportes (TCG) para el ERP: lee la copia de TALONES y REMI que tiene la Raspberry de casa
y manda al ERP quién hizo algo cada día (talón, remisión, relación de viaje o movimiento de caja).

Solo LEE los DBF (nunca los modifica). Sin dependencias: Python 3 estándar.

Cada acción cuenta en la fecha en que realmente pasó:
  talones y remisiones  DOCUMEN    -> FECHA      (quién lo capturó)
                        COBRADOPOR -> FECHAPAGO  (quién lo cobró en caja)
                        REGRESO    -> FECHAREGR  (quién registró el regreso)
  relaciones de viaje   DOCUMEN    -> FECHA,  REGRESO -> FECHAREGR
  caja                  NOMBREU    -> FECHA
Solo se cuentan los nombres que existen en USUARIOS.DBF (evita basura escrita a mano).

Uso:
  python3 asistencia_tcg.py                     # últimos 14 días ya terminados (lo que corre cada noche)
  python3 asistencia_tcg.py --desde 2026-01-01  # carga inicial
  python3 asistencia_tcg.py --prueba            # solo muestra el resumen, no manda nada

Configuración (archivo junto al script, asistencia_tcg.conf, o variables de entorno):
  ERP_URL=https://erp.didara-ti.com
  TOKEN=<clave de asistencia del ERP>
  TALONES=/ruta/a/TALONES   REMI=/ruta/a/REMI
"""
import argparse
import datetime as dt
import json
import os
import struct
import sys
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
# Para ubicar acciones de documentos viejos (un cobro de hoy de un talón de hace un mes) se leen
# los documentos creados hasta este número de días antes del inicio del periodo
MARGEN_DIAS = 90


def leer_config():
    conf = {}
    ruta = os.path.join(AQUI, 'asistencia_tcg.conf')
    if os.path.exists(ruta):
        with open(ruta, encoding='utf-8') as f:
            for linea in f:
                linea = linea.strip()
                if linea and not linea.startswith('#') and '=' in linea:
                    k, v = linea.split('=', 1)
                    conf[k.strip()] = v.strip()
    for k in ('ERP_URL', 'TOKEN', 'TALONES', 'REMI'):
        if os.environ.get(k):
            conf[k] = os.environ[k]
    return conf


class Dbf:
    """Lector mínimo de DBF (dBASE/FoxPro): campos y registros, recorriendo desde el final."""

    def __init__(self, ruta):
        self.f = open(ruta, 'rb')
        cab = self.f.read(32)
        self.n, self.largo_cab, self.largo_reg = struct.unpack('<IHH', cab[4:12])
        desc = self.f.read(self.largo_cab - 32)
        self.campos, pos = {}, 1
        for i in range(0, len(desc) - 31, 32):
            if desc[i] == 0x0D:
                break
            nombre = desc[i:i + 11].split(b'\0')[0].decode('latin-1')
            largo = desc[i + 16]
            self.campos[nombre] = (pos, largo)
            pos += largo

    def valor(self, reg, campo):
        if campo not in self.campos:
            return ''
        pos, largo = self.campos[campo]
        return reg[pos:pos + largo].decode('latin-1').strip()

    def desde_el_final(self, limite_fecha, lote=2000):
        """Registros vigentes del más nuevo al más viejo; para tras 500 seguidos anteriores a limite_fecha."""
        viejos, fin = 0, self.n
        while fin > 0 and viejos < 500:
            ini = max(0, fin - lote)
            self.f.seek(self.largo_cab + ini * self.largo_reg)
            bloque = self.f.read((fin - ini) * self.largo_reg)
            for r in range(fin - ini - 1, -1, -1):
                reg = bloque[r * self.largo_reg:(r + 1) * self.largo_reg]
                if not reg or reg[0] == 0x2A:  # borrado
                    continue
                fecha = self.valor(reg, 'FECHA')
                if not fecha or fecha < limite_fecha:
                    viejos += 1
                    if viejos >= 500:
                        break
                    continue
                viejos = 0
                yield reg
            fin = ini


def limpiar_nombre(texto):
    t = texto.strip()
    if t.lower().startswith('en caja por '):
        t = t[12:]
    return ' '.join(t.rstrip(' .').split()).upper()


def usuarios_validos(*carpetas):
    nombres = set()
    for carpeta in carpetas:
        ruta = os.path.join(carpeta, 'USUARIOS.DBF')
        if not os.path.exists(ruta):
            continue
        d = Dbf(ruta)
        d.f.seek(d.largo_cab)
        for _ in range(d.n):
            reg = d.f.read(d.largo_reg)
            if reg and reg[0] != 0x2A:
                n = limpiar_nombre(d.valor(reg, 'NOMBRE'))
                if n:
                    nombres.add(n)
    return nombres


def a_iso(yyyymmdd):
    return f'{yyyymmdd[:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:8]}' if len(yyyymmdd) == 8 and yyyymmdd.isdigit() else None


def recolectar(talones, remi, desde, hasta):
    """-> (eventos por (fecha, usuario), total de eventos por fecha)"""
    validos = usuarios_validos(talones, remi)
    limite = (dt.date.fromisoformat(desde) - dt.timedelta(days=MARGEN_DIAS)).strftime('%Y%m%d')
    por_usuario, por_dia = {}, {}

    def anotar(fecha_dbf, quien, fuente):
        fecha = a_iso(fecha_dbf)
        nombre = limpiar_nombre(quien)
        if not fecha or not (desde <= fecha <= hasta) or nombre not in validos:
            return
        clave = (fecha, nombre)
        docs, fuentes = por_usuario.get(clave, (0, set()))
        fuentes.add(fuente)
        por_usuario[clave] = (docs + 1, fuentes)
        por_dia[fecha] = por_dia.get(fecha, 0) + 1

    for carpeta, fuente_doc in ((talones, 'talones'), (remi, 'remisiones')):
        ruta = os.path.join(carpeta, 'TALONESS.DBF')
        if os.path.exists(ruta):
            d = Dbf(ruta)
            for reg in d.desde_el_final(limite):
                anotar(d.valor(reg, 'FECHA'), d.valor(reg, 'DOCUMEN'), fuente_doc)
                anotar(d.valor(reg, 'FECHAPAGO'), d.valor(reg, 'COBRADOPOR'), 'caja')
                anotar(d.valor(reg, 'FECHAREGR'), d.valor(reg, 'REGRESO'), fuente_doc)
        ruta = os.path.join(carpeta, 'RELACION.DBF')
        if os.path.exists(ruta):
            d = Dbf(ruta)
            for reg in d.desde_el_final(limite):
                anotar(d.valor(reg, 'FECHA'), d.valor(reg, 'DOCUMEN'), 'relaciones')
                anotar(d.valor(reg, 'FECHAREGR'), d.valor(reg, 'REGRESO'), 'relaciones')
        ruta = os.path.join(carpeta, 'CAJAMOVI.DBF')
        if os.path.exists(ruta):
            d = Dbf(ruta)
            for reg in d.desde_el_final(limite):
                anotar(d.valor(reg, 'FECHA'), d.valor(reg, 'NOMBREU'), 'caja')
    return por_usuario, por_dia


def enviar(url, token, cuerpo):
    req = urllib.request.Request(
        url.rstrip('/') + '/api/transportes/asistencia/importar',
        data=json.dumps(cuerpo).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    ahora = dt.datetime.now()
    # Un día solo se manda cuando ya terminó (la oficina cierra a las 6:45 pm): antes de las 8 pm, hasta ayer
    ultimo = ahora.date() if ahora.hour >= 20 else ahora.date() - dt.timedelta(days=1)
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--desde', default=(ultimo - dt.timedelta(days=14)).isoformat())
    p.add_argument('--hasta', default=ultimo.isoformat())
    p.add_argument('--prueba', action='store_true', help='solo mostrar el resumen, sin mandar nada')
    a = p.parse_args()
    conf = leer_config()
    talones, remi = conf.get('TALONES', ''), conf.get('REMI', '')
    if not os.path.isdir(talones) or not os.path.isdir(remi):
        sys.exit(f'No encuentro las carpetas de TALONES ({talones!r}) y REMI ({remi!r}): revisa asistencia_tcg.conf')

    por_usuario, por_dia = recolectar(talones, remi, a.desde, a.hasta)
    fechas = []
    d = dt.date.fromisoformat(a.desde)
    while d <= dt.date.fromisoformat(a.hasta):
        fechas.append(d.isoformat())
        d += dt.timedelta(days=1)
    dias = [{'fecha': f, 'documentos': por_dia.get(f, 0)} for f in fechas]
    registros = [{'fecha': f, 'usuario': u, 'documentos': n, 'fuentes': sorted(fu)}
                 for (f, u), (n, fu) in sorted(por_usuario.items())]

    resumen = {}
    for r in registros:
        resumen[r['usuario']] = resumen.get(r['usuario'], 0) + 1
    print(f'{dt.datetime.now():%Y-%m-%d %H:%M} · {a.desde} a {a.hasta}: {len(dias)} días, '
          f'{sum(1 for x in dias if x["documentos"])} con movimiento · días por usuario: {resumen}')
    if a.prueba:
        return

    url, token = conf.get('ERP_URL'), conf.get('TOKEN')
    if not url or not token:
        sys.exit('Falta ERP_URL o TOKEN en asistencia_tcg.conf')
    # En partes, por si es una carga grande
    for i in range(0, max(len(dias), 1), 120):
        parte = dias[i:i + 120]
        fechas_parte = {x['fecha'] for x in parte}
        res = enviar(url, token, {'dias': parte, 'registros': [r for r in registros if r['fecha'] in fechas_parte]})
        print('  enviado:', res)


if __name__ == '__main__':
    main()
