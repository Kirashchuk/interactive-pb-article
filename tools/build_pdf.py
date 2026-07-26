# -*- coding: utf-8 -*-
"""
build_pdf.py — PDF-версія аналітичної статті (синхронізована з інтерактивним лонгрідом).

Читає data/pb_data.json, data/analytics.json, data/ukraine_oblasts.geojson і збирає
статтю у PDF: заголовок, текст розділів, графіки, таблиці, ДОДАТОК A з картами України
за роками та ДОДАТОК B — повна таблиця 35 міст. Обсяг — 12+ сторінок.
Шрифт — Times New Roman (кирилиця).

Запуск: python tools/build_pdf.py
"""
import json
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle as PS
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle, KeepTogether, PageBreak)
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart

import pdf_map

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
DATA = os.path.join(PROJECT, 'data')

pb = json.load(open(os.path.join(DATA, 'pb_data.json'), encoding='utf-8'))
an = json.load(open(os.path.join(DATA, 'analytics.json'), encoding='utf-8'))
geo = json.load(open(os.path.join(DATA, 'ukraine_oblasts.geojson'), encoding='utf-8'))

# ------------------------------------------------------------------- шрифти
FONTDIR = r'C:\Windows\Fonts'
pdfmetrics.registerFont(TTFont('Times', os.path.join(FONTDIR, 'times.ttf')))
pdfmetrics.registerFont(TTFont('Times-Bold', os.path.join(FONTDIR, 'timesbd.ttf')))
pdfmetrics.registerFont(TTFont('Times-Italic', os.path.join(FONTDIR, 'timesi.ttf')))
pdfmetrics.registerFont(TTFont('Times-BoldItalic', os.path.join(FONTDIR, 'timesbi.ttf')))
pdfmetrics.registerFontFamily('Times', normal='Times', bold='Times-Bold',
                              italic='Times-Italic', boldItalic='Times-BoldItalic')

NBSP = ' '

def fmt_int(v):
    return f'{round(v):,}'.replace(',', NBSP)

def fmt_mln(v):
    return f'{v/1e6:.1f}'.replace('.', ',')

def pct(v, d=2):
    return f'{100*v:.{d}f}'.replace('.', ',') + f'{NBSP}%'

# ------------------------------------------------------------------- стилі
BLUE = colors.HexColor('#2a78d6')
ORANGE = colors.HexColor('#eb6834')
INK = colors.HexColor('#1a1a1a')
MUTED = colors.HexColor('#666666')
GRID = colors.HexColor('#d8d8d2')

S = {}
S['title'] = PS('title', fontName='Times-Bold', fontSize=19, leading=23, textColor=INK, spaceAfter=6)
S['subtitle'] = PS('subtitle', fontName='Times-Italic', fontSize=11.5, leading=15, textColor=MUTED, spaceAfter=10)
S['meta'] = PS('meta', fontName='Times', fontSize=9, leading=12, textColor=MUTED, spaceAfter=2)
S['h2'] = PS('h2', fontName='Times-Bold', fontSize=13.5, leading=17, textColor=INK, spaceBefore=14, spaceAfter=5)
S['h3'] = PS('h3', fontName='Times-Bold', fontSize=11.5, leading=15, textColor=INK, spaceBefore=10, spaceAfter=4)
S['body'] = PS('body', fontName='Times', fontSize=10.8, leading=15.5, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=7, firstLineIndent=14)
S['lead'] = PS('lead', fontName='Times-Italic', fontSize=11.2, leading=16, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=8)
S['cap'] = PS('cap', fontName='Times-Italic', fontSize=8.5, leading=11, textColor=MUTED, spaceBefore=2, spaceAfter=10)
S['src'] = PS('src', fontName='Times', fontSize=8.6, leading=11.5, textColor=INK, spaceAfter=2, leftIndent=14, firstLineIndent=-14)
S['tblh'] = PS('tblh', fontName='Times-Bold', fontSize=8.6, leading=10.5, textColor=colors.white, alignment=TA_CENTER)
S['tbl'] = PS('tbl', fontName='Times', fontSize=8.7, leading=10.8, textColor=INK, alignment=TA_CENTER)
S['tbll'] = PS('tbll', fontName='Times', fontSize=8.7, leading=10.8, textColor=INK, alignment=TA_LEFT)

story = []
P = lambda t, s='body': story.append(Paragraph(t, S[s]))
GAP = lambda h=4: story.append(Spacer(1, h))


# ------------------------------------------------------- графіки (reportlab)
def amount_chart():
    years = pb['years']
    vals = [pb['totals'][str(y)]['amount'] / 1e6 for y in years]
    d = Drawing(460, 175)
    lp = LinePlot()
    lp.x, lp.y, lp.width, lp.height = 34, 26, 400, 128
    lp.data = [list(zip(range(len(years)), vals))]
    lp.lines[0].strokeColor = BLUE
    lp.lines[0].strokeWidth = 2
    lp.lines[0].symbol = None
    lp.xValueAxis.valueMin = 0
    lp.xValueAxis.valueMax = len(years) - 1
    lp.xValueAxis.valueSteps = list(range(len(years)))
    lp.xValueAxis.labelTextFormat = lambda i: str(years[int(i)]) if int(i) % 2 == 0 else ''
    lp.xValueAxis.labels.fontName = 'Times'
    lp.xValueAxis.labels.fontSize = 7.5
    lp.yValueAxis.valueMin = 0
    lp.yValueAxis.valueMax = 700
    lp.yValueAxis.valueStep = 175
    lp.yValueAxis.labels.fontName = 'Times'
    lp.yValueAxis.labels.fontSize = 7.5
    lp.yValueAxis.strokeColor = GRID
    lp.xValueAxis.strokeColor = GRID
    d.add(lp)
    d.add(String(34, 162, 'млн грн', fontName='Times-Italic', fontSize=7.5, fillColor=MUTED))
    return d


def share_year_chart():
    """Стовпчики: медіана частки за роками (2018–2026)."""
    rows = an['byYear']
    d = Drawing(460, 175)
    bc = VerticalBarChart()
    bc.x, bc.y, bc.width, bc.height = 34, 26, 410, 128
    bc.data = [[r['median'] * 100 for r in rows]]
    bc.categoryAxis.categoryNames = [str(r['year']) for r in rows]
    bc.categoryAxis.labels.fontName = 'Times'
    bc.categoryAxis.labels.fontSize = 7.5
    bc.valueAxis.valueMin = 0
    bc.valueAxis.valueMax = 0.4
    bc.valueAxis.valueStep = 0.1
    bc.valueAxis.labels.fontName = 'Times'
    bc.valueAxis.labels.fontSize = 7.5
    bc.valueAxis.labelTextFormat = lambda v: f'{v:.1f}%'.replace('.', ',')
    bc.bars[0].fillColor = ORANGE
    bc.barWidth = 12
    d.add(bc)
    d.add(String(34, 162, '% видатків міста (медіана року)', fontName='Times-Italic',
                 fontSize=7.5, fillColor=MUTED))
    return d


def coverage_table():
    """Повнота зіставних спостережень для розрахунку частки."""
    rows = [
        ['2015–2017', '105', '0 / 105*', '0 / 105', '0 %'],
        ['2018–2021', '140', '140 / 140', '111 / 140', '79,3 %'],
        ['2022–2026', '175', '175 / 175', '20 / 175', '11,4 %'],
        ['2018–2026', '315', '315 / 315', '131 / 315', '41,6 %'],
    ]
    return make_table(
        ['Період', 'Можливих', 'Видатки міст', 'Зіставних', 'Покриття'],
        rows, [3.0*cm, 2.5*cm, 3.7*cm, 3.6*cm, 2.8*cm],
        aligns=['c', 'c', 'c', 'c', 'c'])


def intl_chart():
    rows = [
        ('Великі міста України (факт)', an['summary']['mean'], True),
        ('Барселона (розрахунок)', an['barcelona']['share'], False),
        ('Париж (≈1% загального)', 0.01, False),
        ('Європейська практика', 0.01, False),
        ('Шотландія (ціль ≥1%)', 0.01, False),
    ]
    d = Drawing(460, 150)
    bc = HorizontalBarChart()
    bc.x, bc.y, bc.width, bc.height = 150, 14, 270, 120
    bc.data = [[r[1] * 100 for r in rows]]
    bc.categoryAxis.categoryNames = [r[0] for r in rows]
    bc.categoryAxis.labels.fontName = 'Times'
    bc.categoryAxis.labels.fontSize = 8
    bc.categoryAxis.labels.boxAnchor = 'e'
    bc.categoryAxis.labels.dx = -3
    bc.valueAxis.valueMin = 0
    bc.valueAxis.valueMax = 1.1
    bc.valueAxis.valueStep = 0.25
    bc.valueAxis.labels.fontName = 'Times'
    bc.valueAxis.labels.fontSize = 7.5
    bc.valueAxis.labelTextFormat = lambda v: f'{v:.2f}%'.replace('.', ',')
    bc.bars[0].fillColor = colors.HexColor('#b8b6ae')
    bc.bars[(0, 0)].fillColor = BLUE
    bc.barWidth = 7
    bc.groupSpacing = 6
    d.add(bc)
    return d


def make_table(header, rows, col_widths, aligns=None, fs=None):
    hz = S['tblh']
    data = [[Paragraph(h, hz) for h in header]]
    for r in rows:
        cells = []
        for i, c in enumerate(r):
            st = 'tbll' if (aligns and aligns[i] == 'l') else 'tbl'
            cells.append(Paragraph(str(c), S[st]))
        data.append(cells)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, GRID),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f2')]),
    ]))
    return t


# ==================================================================== СТАТТЯ
P('Ресурсний вимір міської участі: бюджети участі великих міст України, 2015–2026', 'title')
P('Партисипативні процеси у міському розвитку: поширення механізму та його глибина '
  'у частці міських видатків', 'subtitle')
P(f'Аналітична стаття · суспільна географія · вибірка: 35 великих міст України · '
  f'дані станом на {pb["meta"]["generated"]}', 'meta')
GAP(8)

P('Бюджет участі («громадський бюджет») — механізм прямої демократії: міська рада '
  'резервує частину бюджету, а мешканці подають власні проєкти й голосуванням '
  'вирішують, які з них буде профінансовано. У суспільно-географічному вимірі участь — '
  'це не додатковий комунікаційний сервіс, а механізм перерозподілу управлінської '
  'видимості, доступу до порядку денного і частково — до ресурсів.', 'lead')

P('<b>Бюджет участі як ресурсний шар міської участі.</b> '
  'Партисипативні канали утворюють кілька шарів: від низькопорогових звернень та '
  'інформування через консультаційні опитування й петиції до ресурсно значущих '
  'форматів. Бюджет участі належить до найсильнішого шару: тут мешканець не лише '
  'висловлює позицію, а й підтримує конкретний проєкт, який змінює локальний простір, а '
  'участь набуває матеріального і просторово локалізованого виміру. Саме тому бюджет '
  'участі — зручний індикатор глибини партисипації: кількість каналів чи голосів ще не '
  'свідчить про силу впливу на рішення, натомість частка міського бюджету, яку громада '
  'розподіляє напряму, показує, наскільки участь вбудована в розподіл ресурсу.')

P('<b>Походження і перенесення практики в Україну.</b> Сучасна модель бюджету участі сформувалася в Порту-Алегрі '
  '(Бразилія) наприкінці 1980-х років у контексті демократизації та децентралізації; її ядро — поєднання '
  'відкритого обговорення міських потреб із реальним впливом мешканців на пріоритети публічних інвестицій. '
  'В Україну практика прийшла переважно через польський досвід і мережі міжнародної співпраці: у 2014 році PAUCI '
  'презентувала українським громадам польські підходи, а у 2015 році перші програми запровадили Чернігів, Черкаси '
  'та Полтава. У кількісній вибірці цієї статті за 2015 рік повні показники підтверджено для двох міст, тому це не '
  'тотожне числу всіх ранніх запусків.')

P('<b>Поширення: платформи та EGAP.</b> '
  'Подальше поширення пішло через '
  'цифрові платформи — «Громадський проєкт» (pb.org.ua), модуль бюджету участі системи '
  'e-DEM та рішення BISSoft — за підтримки швейцарсько-української програми EGAP. '
  'Платформи дали містам готову інфраструктуру подання проєктів, верифікації учасників і '
  'публічного голосування. Нормативно механізм закріплювався локально: кожне місто '
  'ухвалювало власне Положення, а кошти передбачалися у видатках міського бюджету, а не '
  'в окремому позабюджетному фонді — тобто бюджет участі конкурує за ресурс усередині '
  'звичайного міського бюджету. Переломним став 2016 рік: за дванадцять місяців механізм '
  'запровадили 17 міст, а число активних міст зросло з 2 до 20.')

P('<b>Динаміка та глибина участі: 2015–2026.</b> '
  'Динаміка розкладається на три фази. Перша — стрімке поширення 2015–2018 років, коли '
  'число активних міст зросло з 2 до 32, а фінансування — з 4,8 млн до 564 млн грн. '
  'Друга — плато 2019–2021 років: охоплення стабілізується на ~30 містах, суми '
  'коливаються навколо 520–650 млн грн, а бюджет участі стає нормою міського життя. '
  'Третя — розрив після 24.02.2022: більшість програм призупинено, і показники '
  '2022–2026 років відображають лише підтверджені цикли (документований мінімум). '
  'Падіння кривих не означає, що участь зникла, — воно фіксує обрив верифікованих даних '
  'і згортання діючих програм в умовах війни.')

story.append(KeepTogether([amount_chart(),
              Paragraph('Рис. 1. Сумарні кошти бюджетів участі за роками, млн грн '
                        '(2022–2026 — підтверджений мінімум).', S['cap'])]))

P('Таблиця 1. Зведені показники за роками', 'h3')
rows1 = []
for y in pb['years']:
    t = pb['totals'][str(y)]
    rows1.append([y, fmt_int(t['activeCities']), fmt_int(t['applications']),
                  fmt_int(t['winners']), fmt_mln(t['amount'])])
story.append(make_table(
    ['Рік', 'Активних міст', 'Заявок', 'Переможців', 'Кошти, млн грн'],
    rows1, [1.8*cm, 3.0*cm, 2.6*cm, 2.6*cm, 3.0*cm]))
P('Показники 2022–2026 років — документований мінімум за підтвердженими циклами; '
  'порожні значення не дорівнюють нулю.', 'cap')

story.append(PageBreak())

# ---- глибина ----
sm = an['summary']
P('Глибина: близько 0,3 % міських видатків', 'h2')
P('Поширення механізму — лише одна сторона. Друга, важливіша для оцінки глибини участі, — '
  f'яку частку міського бюджету громади розподіляють напряму. За {sm["n"]} зіставним '
  'спостереженням 2018–2026 років ця частка становить у середньому близько 0,3 % '
  f'загальних видатків міста (медіана {pct(sm["median"])}, зважена {pct(sm["weighted"])}). '
  'Це стійкий емпіричний центр української практики і водночас скромний рівень: він '
  'нижчий за аналітичний інституційний мінімум 0,5 % (поріг сталої програми) і '
  'втричі менший за зрілий орієнтир 1 %. Загальнодержавної відсоткової норми в Україні '
  'не існує.')

story.append(KeepTogether([share_year_chart(),
              Paragraph('Рис. 2. Медіана частки бюджету участі у видатках міста за роками, '
                        '% (зіставні спостереження).', S['cap'])]))

# таблиці частки + лідери поруч
rows2 = [[d['year'], d['n'], pct(d['mean']), pct(d['median']), pct(d['weighted'])]
         for d in an['byYear']]
t2 = make_table(['Рік', 'N', 'Середнє', 'Медіана', 'Зважена'],
                rows2, [1.5*cm, 1.0*cm, 2.0*cm, 2.0*cm, 2.0*cm])
rows3 = [[p['city'], pct(p['mean']), f"{p['firstYear']}–{p['lastYear']}"]
         for p in an['profiles'][:12]]
t3 = make_table(['Місто', 'Середня частка', 'Роки'],
                rows3, [3.4*cm, 2.6*cm, 2.4*cm], aligns=['l', 'c', 'c'])
side = Table([[t2, t3]], colWidths=[8.9*cm, 8.7*cm])
side.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                          ('LEFTPADDING', (0, 0), (-1, -1), 0),
                          ('RIGHTPADDING', (0, 0), (0, 0), 10)]))
P('Таблиця 2. Частка за роками · Таблиця 3. Міста-лідери за часткою', 'h3')
story.append(side)
P('Таблиця 2 (ліворуч) — частка за роками; Таблиця 3 (праворуч) — 12 міст-лідерів за '
  'середньою часткою у зіставні роки.', 'cap')

P('За середнім ховається значна міжміська нерівність. Лідери спрямовують на бюджет '
  'участі 0,5–0,8 % видатків (Черкаси 0,82 %, Івано-Франківськ 0,66 %, '
  'Чернігів 0,54 %), тоді як нижня межа опускається до 0,1–0,15 %. Глибина '
  'участі залежить не від наявності платформи, а від інституційної спроможності й '
  'політичної волі конкретного міста — тобто якість партисипації визначається не '
  'кількістю каналів, а реальною вагою каналу в розподілі ресурсу.')

story.append(PageBreak())

# ---- міжнародне ----
P('Міжнародні орієнтири', 'h2')
P('Універсального «правильного відсотка» не існує — UN-Habitat прямо зазначає '
  'відсутність єдиного оптимуму. У зіставленні з однаковим знаменником (частка '
  'загального бюджету міста) українські 0,3 % — помірний рівень. Індикативна частка '
  'Барселони становить близько 0,2 %, тоді як Париж (5 % інвестиційного бюджету '
  '≈ 1 % загального), узагальнена європейська практика (~1 %) та офіційна ціль '
  'Шотландії (щонайменше 1 %) лежать помітно вище. Коректність порівняння тримається '
  'на знаменнику: діапазон Світового банку 5–10 % стосується дохідного бюджету, а '
  'сінгапурський пілот (S$200 тис.) — фонду мікрорайону, тож ці числа не зводяться до '
  'частки загальних видатків міста.')
story.append(KeepTogether([intl_chart(),
              Paragraph('Рис. 3. Частка бюджету участі в загальному бюджеті міста: '
                        'Україна (факт) проти міжнародних кейсів і цілей.', S['cap'])]))

# таблиця міжнародних кейсів
P('Таблиця 4. Міжнародні орієнтири та знаменники', 'h3')
intl_rows = [
    ['Україна', 'нормативу немає', 'частина місцевого бюджету', 'Мінфін №94 (2020)'],
    ['Барселона', '≈0,20 %/рік', 'загальний бюджет міста', '€30 млн / 4 роки'],
    ['Париж', '≈1 % загального', 'інвестиційний бюджет', '5 % інвестиційного (OECD)'],
    ['Європа (огляд)', '≈1 %', 'муніципальний бюджет', 'UN-Habitat'],
    ['Шотландія', '≥1 %', 'бюджети місцевого самовряд.', 'урядова ціль'],
    ['Світовий банк', '5–10 %', 'дохідний бюджет', 'toolkit; верхня межа'],
    ['Сінгапур', 'не визначається', 'фонд мікрорайону', 'пілот S$200 тис.'],
]
story.append(make_table(
    ['Географія', 'Заявлена частка', 'Знаменник', 'Джерело / примітка'],
    intl_rows, [2.8*cm, 3.0*cm, 4.6*cm, 4.6*cm],
    aligns=['l', 'c', 'l', 'l']))
P('Порівнювати можна лише частки з однаковим знаменником; кейси з іншим знаменником '
  '(Світовий банк, Сінгапур) не зводяться до частки загальних видатків міста.', 'cap')

# ---- висновки ----
P('Висновки', 'h2')
P('За 2015–2026 роки бюджет участі пройшов шлях від двох міст-піонерів до '
  'загальнонаціональної, хоч і нерівномірної, практики великих міст, а після 2022 року — '
  'до різкого згортання під тиском війни. Проте поширеність механізму не тотожна глибині '
  'участі. У ресурсному вимірі українські міста розподіляють напряму близько 0,3 % '
  'видатків — нижче за інституційний мінімум сталої програми і втричі менше за зрілий '
  'міжнародний орієнтир 1 %.')
P('Це узгоджується з висновком суспільно-географічного аналізу партисипативних процесів: '
  'якість участі визначається не кількістю каналів чи голосів, а реальною вагою каналу в '
  'розподілі ресурсу і його вбудованістю в міську процедуру. Тому стратегічний виклик для '
  'української практики — не стільки запровадження нових форматів, скільки поглиблення '
  'вже наявного: підвищення частки, стабільність процедур і публічна відстежуваність '
  'виконання, що перетворюють участь із символічного жесту на керований ресурс міського '
  'розвитку.')

P('Методика та застереження', 'h2')
P('Рамка дослідження — 35 міст: 34 міста з населенням понад 100 тис. осіб на 01.01.2022 '
  '(без АР Крим і м. Севастополь) та Сєвєродонецьк як обґрунтований виняток. Часовий '
  'інтервал — 2015–2026 роки. Порожня клітинка не дорівнює нулю: стани «немає '
  'підтверджених даних», «до запуску», «призупинено», «не проводився» розрізняються явно. '
  'Суми мають різні основи (річний ліміт, сума бюджетів переможців, фактичні видатки) і '
  'не усереднюються між містами. Знаменник частки — затверджені річні видатки міста '
  '(Open Budget API Мінфіну); зіставними вважаються лише пари «сума бюджету участі + '
  'видатки міста» одного року. Ця PDF-версія синхронізована з інтерактивним лонгрідом: '
  'спільні дані, показники й висновки.')

P('Повнота зіставних спостережень', 'h3')
P('Зіставним є лише спостереження «місто × рік», у якому одночасно верифіковано суму '
  'бюджету участі з придатною для порівняння основою та затверджені річні видатки цього '
  'самого міста. Порожня клітинка не трактується як нуль і не включається до розрахунку '
  'частки.')
story.append(coverage_table())
P('* У використаному запиті Open Budget API немає потрібних для уніфікованого розрахунку '
  'значень за 2015–2017 роки. Це не означає, що міські бюджети не ухвалювалися або не могли '
  'бути оприлюднені в інших документах.', 'cap')
P('До 2018 року в наборі частково наявні самі бюджети участі: один повний запис за 2015 рік, '
  '15 — за 2016-й і 20 — за 2017-й. Проте без однаково отриманого знаменника — загальних '
  'видатків міста — їх не можна коректно перетворити на частку. Для такого розрахунку потрібне '
  'окреме збирання рішень кожної міської ради про бюджет за відповідний рік.')
P('У 2018–2021 роках повнота становить 79,3 %, тому висновок про рівень близько 0,3 % '
  'стосується саме довоєнної практики великих міст і має достатнє покриття. У 2022–2026 роках '
  'видатки міст у Open Budget API наявні для всіх 175 спостережень, але бракує підтверджених '
  'завершених циклів бюджетів участі: програми призупинялися або скасовувалися, частина міст '
  'була окупована, а для частини циклів не оприлюднено повних підсумків. Тому 20 із 175 '
  'записів не дозволяють поширювати результат на всі міста; відсутність даних не означає '
  'нульового фінансування.')
P('Чисельник частки — сума бюджету участі — зібрано насамперед з офіційних матеріалів '
  'міських рад і структурованих міських платформ; для пошуку та перехресної перевірки '
  'використано e-DEM, інші платформи громадського бюджету, BISSoft і матеріали EGAP. '
  'Знаменник — сума показника ZAT_AMT за загальним фондом (FUND_TYP=T) у найпізнішому '
  'доступному місячному звіті року з Open Budget API Мінфіну. Реєстр містить 470 записів '
  'джерел: 315 записів порталу публічних фінансів, 75 офіційних муніципальних або державних '
  'джерел, 26 записів e-DEM, 22 міських платформ, 22 допоміжних джерел, 7 офіційних державних '
  'та 3 інституційно-аналітичні джерела.')
P('Частка у видатках є співвідношенням планової або виділеної суми бюджету участі до '
  'затверджених видатків міста, а не доказом фактичного виконання проєктів.', 'cap')

story.append(PageBreak())

# ==================================================== ХРОНІКА ЗА РОКАМИ
P('Хроніка партисипації: рік за роком', 'h2')
P('Нижче — стислий літопис поширення й глибини бюджету участі, що відповідає '
  'покроковій оповіді інтерактивного лонгріда (блок «Динаміка та глибина участі»).', 'body')
chronicle = [
    ('2015', 'Механізм стартував із двох міст — Чернігова і Черкас: 127 заявок, 23 переможці, '
             'близько 4,8 млн грн. Поодинокі локальні експерименти прямої демократії.'),
    ('2016', 'Переломний рік: за дванадцять місяців бюджет участі запровадили 17 міст, а їх '
             'загальна кількість зросла до 20; фінансування підскочило до ~159 млн грн.'),
    ('2017', '27 активних міст і 3,8 тис. заявок. Долучаються найбільші міста (Дніпро, Одеса), '
             'а сумарне фінансування зростає більш ніж удвічі — до ~425 млн грн.'),
    ('2018', 'Пік поширення: 32 активних міста, понад тисяча переможців, ~564 млн грн. Саме з '
             '2018-го можна зіставляти суми з видатками міст і вимірювати глибину участі.'),
    ('2019', 'Рекордні 5,2 тис. поданих проєктів при 30 активних містах; фінансування дещо '
             'знижується (~519 млн грн). Процедури зрілі.'),
    ('2020', 'Попри COVID-19 і паузи в частині міст сумарне фінансування зростає до ~616 млн грн; '
             'медіана частки видатків тримається близько 0,33 %.'),
    ('2021', 'Останній повний довоєнний рік: рекордні ~648 млн грн і 1,2 тис. переможців. Але в '
             'частці видатків це лише ~0,3 % — нижче за мінімум 0,5 %. Поширеність ≠ глибина.'),
    ('2022', 'Повномасштабне вторгнення обриває практику: більшість міст призупиняють конкурси. '
             'Далі показники — лише документований мінімум за підтвердженими циклами.'),
    ('2023', 'Точкове відновлення: конкурси повертають одиниці міст (зокрема Івано-Франківськ). '
             'Загальна активність вибірки лишається низькою.'),
    ('2024', 'Підтверджені цикли у 5 містах; паралельно триває реалізація проєктів-переможців '
             'попередніх років. Частина міст свідомо не проводить нових конкурсів.'),
    ('2025', 'У містах з активними програмами суми зростають. Відсутні значення по більшості '
             'вибірки — наслідок війни, а не нульове фінансування.'),
    ('2026', 'Стан джерел на 23.07.2026: підтверджені конкурси у 5 містах, сумарно ~93 млн грн, '
             'більшість обсягу формує Івано-Франківськ.'),
]
for yr, txt in chronicle:
    P(f'<b>{yr}.</b> {txt}', 'body')

story.append(PageBreak())

# ==================================================== ДОДАТОК A: КАРТИ
P('Додаток A. Географія поширення: карти за роками', 'h2')
P('Картодіаграми відображають ту саму вибірку, що й інтерактивна карта лонгріда: '
  'бульбашки — міста вибірки (розмір пропорційний сумі бюджету участі за рік), заливка '
  'областей — сумарне значення по містах вибірки в області. АР Крим і м. Севастополь — '
  'поза рамкою дослідження. Нижче — чотири річні зрізи (хвиля 2016 року, найширше '
  'охоплення 2018-го, пік фінансування 2021-го та поточний стан 2026-го) і сумарна карта '
  'за весь період.')

mm = pdf_map.MapMaker(geo, pb['cities'], pb['years'], width=460, height=320)
map_years = [(2016, 'A.1', 'Хвиля запровадження: 20 активних міст, ~159 млн грн'),
             (2018, 'A.2', 'Найширше охоплення: 32 активних міста, ~564 млн грн'),
             (2021, 'A.3', 'Пік фінансування: 31 місто, ~648 млн грн'),
             (2026, 'A.4', 'Поточний стан: 5 підтверджених міст, ~93 млн грн')]
for i, (yr, tag, cap) in enumerate(map_years):
    if i > 0:
        story.append(PageBreak())
    story.append(KeepTogether([
        Paragraph(f'Карта {tag}. Бюджети участі, {yr} рік', S['h3']),
        Spacer(1, 6),
        mm.draw(yr),
        pdf_map.legend(width=460),
        Paragraph(f'<b>{yr}.</b> {cap}. Розмір бульбашки пропорційний сумі бюджету участі міста за рік; '
                  'заливка області — сума по її містах вибірки.', S['cap']),
    ]))

# Сумарна карта за весь період (агрегація по містах)
story.append(PageBreak())
agg_cities = []
for c in pb['cities']:
    total = sum((c['years'].get(str(y)) or {}).get('s') or 0 for y in pb['years'])
    cc = dict(c)
    cc['years'] = {'ALL': {'status': 'data', 's': total} if total else {'status': 'nodata', 's': None}}
    agg_cities.append(cc)
mm_all = pdf_map.MapMaker(geo, agg_cities, ['ALL'], width=460, height=330)
story.append(KeepTogether([
    Paragraph('Карта A.5. Сумарний бюджет участі за 2015–2026 роки', S['h3']),
    Spacer(1, 6),
    mm_all.draw('ALL'),
    pdf_map.legend(width=460),
    Paragraph('Розмір бульбашки — сумарний обсяг бюджету участі міста за 2015–2026 роки; заливка '
              'області — сума по її містах вибірки. Найбільші програми — Київ, Одеса, Львів, Дніпро, '
              'Івано-Франківськ, Харків.', S['cap']),
]))

story.append(PageBreak())

# ==================================================== ДОДАТОК B: 35 МІСТ
P('Додаток B. Показники за містами, 2015–2026', 'h2')
P('Сумарний обсяг бюджету участі за 2015–2026 роки та середня частка у видатках міста '
  '(за зіставні роки). Міста, що перебували на ТОТ після 24.02.2022, позначено. '
  'Ранжовано за сумарним обсягом.', 'body')

# профілі за містом → середня частка
prof = {p['city']: p for p in an['profiles']}
city_rows = []
for c in pb['cities']:
    total = sum((c['years'].get(str(y)) or {}).get('s') or 0 for y in pb['years'])
    p = prof.get(c['name'])
    share = pct(p['mean']) if p else '—'
    yrs = f"{p['firstYear']}–{p['lastYear']}" if p else '—'
    tot = ' *' if c.get('tot2022') else ''
    city_rows.append((total, [c['name'] + tot, fmt_int(c['population']),
                              c['firstYear'] or '—', fmt_mln(total) if total else '—',
                              share, yrs]))
city_rows.sort(key=lambda r: -r[0])
rows_b = [r[1] for r in city_rows]

story.append(make_table(
    ['Місто', 'Населення', 'Перший рік', 'Σ БУ, млн грн', 'Сер. частка', 'Роки частки'],
    rows_b, [3.6*cm, 2.4*cm, 2.0*cm, 2.6*cm, 2.4*cm, 2.4*cm],
    aligns=['l', 'c', 'c', 'c', 'c', 'c']))
P('* Місто на тимчасово окупованій території після 24.02.2022. «Сер. частка» — середня '
  'частка бюджету участі у видатках міста за роки з зіставними даними.', 'cap')

# ---- джерела ----
P('Джерела', 'h2')
sources = [
    'Авторський набір даних «Бюджети участі великих міст України 2015–2026: міжнародне '
    'порівняння» (420 записів місто-рік, 131 зіставне спостереження частки, реєстр із 470 джерел).',
    'Платформи бюджету участі: pb.org.ua, e-DEM (budget.e-dem.ua), BISSoft; аналітичні звіти EGAP.',
    'Загальні видатки міст: Open Budget API Мінфіну (api.openbudget.gov.ua).',
    'Населення міст: Держстат, «Чисельність наявного населення України на 1 січня 2022».',
    'Межі областей: geoBoundaries, UKR ADM1 (simplified), CC BY 4.0.',
    'OECD. OECD Guidelines for Citizen Participation Processes. Paris: OECD Publishing, 2022.',
    'UN-Habitat. Participatory Budgeting in Africa: A Training Companion.',
    'Scottish Government–COSLA. Framework Agreement on Participatory Budgeting (ціль ≥1%).',
    'OECD. Participatory budgeting case (Paris, 2017); World Bank. Mainstreaming Citizen '
    'Engagement in PFM (2020).',
    'Ajuntament de Barcelona. Pressupostos participatius 2024–2027.',
    'SUTD / The Straits Times. Spottiswoode Park participatory budgeting pilot (2026).',
]
for i, s in enumerate(sources, 1):
    P(f'{i}. {s}', 'src')

# ==================================================================== ЗБІРКА
OUT = os.path.join(PROJECT, 'Стаття_Бюджети_участі_2015-2026.pdf')


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Times', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(2*cm, 1.1*cm,
                      'Ресурсний вимір міської участі: бюджети участі великих міст України, 2015–2026')
    canvas.drawRightString(A4[0] - 2*cm, 1.1*cm, str(doc.page))
    canvas.setStrokeColor(GRID)
    canvas.line(2*cm, 1.4*cm, A4[0] - 2*cm, 1.4*cm)
    canvas.restoreState()


def repair_2026_map_heading(path):
    """Усуває накладання векторної карти 2026 року на її заголовок у ReportLab."""
    import fitz

    document = fitz.open(path)
    changed = False
    for page in document:
        if 'Карта A.4.' not in page.get_text():
            continue
        page.draw_rect(fitz.Rect(0, 0, 350, 90), color=None, fill=(1, 1, 1), overlay=True)
        page.insert_text(
            (2 * cm, 41), 'Карта A.4. Бюджети участі, 2026 рік',
            fontname='times_new_roman_bold', fontfile=os.path.join(FONTDIR, 'timesbd.ttf'),
            fontsize=11.5, color=(0.102, 0.102, 0.102), overlay=True)
        changed = True
        break
    if changed:
        document.saveIncr()
    document.close()


doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=2*cm, rightMargin=2*cm,
                        topMargin=1.6*cm, bottomMargin=1.8*cm,
                        title='Ресурсний вимір міської участі: бюджети участі великих міст України, 2015–2026',
                        author='Дисертаційне дослідження')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
repair_2026_map_heading(OUT)
print('PDF:', OUT, '|', os.path.getsize(OUT), 'bytes')
