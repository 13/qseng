using Qseng.Domain.Entities;
using Qseng.Domain.Enums;
using Qseng.Domain.ValueObjects;
using Qseng.Infrastructure.Persistence;

namespace Qseng.Infrastructure.Seeding;

internal static class DemoData
{
    public static void Build(Guid treeId, QsengDbContext db)
    {
        // ── Generation I (born 1843–1853) ────────────────────────────────────
        var georgEscobar      = P(treeId, "Georg",     "Escobar",        Sex.Male,   (1845,3,12),  (1912,8,4),   "Schwaz, Tirol",   null,        "Bergbauer und Zimmermann. Baute das Familienhaus in Schwaz mit eigenen Händen.");
        var theresiaEscobar   = P(treeId, "Theresia",  "Escobar",        Sex.Female, (1848,6,24),  (1917,2,11),  "Wörgl, Tirol",    "Moser",     "Gläubige Frau, bekannt für ihre Heilkräuter-Kenntnisse im Dorf.");
        var konradSmith    = P(treeId, "Konrad",    "Smith",       Sex.Male,   (1843,11,5),  (1909,4,17),  "Bregenz",         null,        "Weber und späterer Tuchhandelsmann in Bregenz.");
        var mariaSmithI    = P(treeId, "Maria",     "Smith",       Sex.Female, (1850,1,30),  (1916,9,3),   "Feldkirch",       "Berger",    "Tochter eines Kaufmanns aus Feldkirch.");
        var franzSpathI     = P(treeId, "Franz",     "Spath",        Sex.Male,   (1847,7,19),  (1913,12,6),  "Wien, Favoriten", null,        "Schlosser in den Wiener Fabrikvierteln. Mitglied der frühen Arbeiterbewegung.");
        var annaSpathI      = P(treeId, "Anna",      "Spath",        Sex.Female, (1851,4,2),   (1920,5,28),  "Wien, Ottakring", "Gruber",    "Wäscherin und Heimnäherin. Hielt die Familie durch die schweren Jahre zusammen.");
        var josephHuber     = P(treeId, "Joseph",    "Huber",        Sex.Male,   (1849,9,14),  (1910,6,22),  "Salzburg",        null,        "Bäcker, betrieb eine kleine Backstube in der Salzburger Altstadt.");
        var katharinaHuber  = P(treeId, "Katharina", "Huber",        Sex.Female, (1852,12,8),  (1919,3,15),  "Hallein",         "Bauer",     "Kam aus dem Salzbergwerksort Hallein. Überlebte den Ersten Weltkrieg als Witwe.");

        // ── Generation II (born 1876–1888) ───────────────────────────────────
        var johannEscobar     = P(treeId, "Johann",    "Escobar",        Sex.Male,   (1878,4,12),  (1949,11,3),  "Schwaz, Tirol",   null,        "Erlernte das Tischlerhandwerk beim Vater. Gründete 1910 eine eigene Werkstatt in Innsbruck.");
        var marieSmith     = P(treeId, "Marie",     "Escobar",        Sex.Female, (1882,6,1),   (1955,2,14),  "Bregenz",         "Smith",    "Nähte Festtrachten für den Bregenzer Markt. Zog nach der Heirat nach Innsbruck.");
        var aloisEscobar      = P(treeId, "Alois",     "Escobar",        Sex.Male,   (1880,10,3),  (1952,7,27),  "Schwaz, Tirol",   null,        "Jüngerer Bruder Johanns. Übernahm den väterlichen Hof, bis dieser 1930 verkauft wurde.");
        var rosaHuber       = P(treeId, "Rosa",      "Escobar",        Sex.Female, (1884,2,18),  (1960,4,5),   "Salzburg",        "Huber",     "Zog nach Tirol nach der Heirat. War für ihren Apfelstrudel im ganzen Dorf bekannt.");
        var ottoSmith      = P(treeId, "Otto",      "Smith",       Sex.Male,   (1876,8,22),  (1938,1,14),  "Bregenz",         null,        "Uhrmacher, übernahm das väterliche Tuchgeschäft nicht und eröffnete stattdessen eine Uhrenwerkstatt.");
        var eliseSpathII    = P(treeId, "Elise",     "Smith",       Sex.Female, (1879,5,9),   (1941,11,30), "Wien, Favoriten", "Spath",     "Tochter des Schlossers Franz Spath. Heiratete nach Vorarlberg, vermisste Wien ihr Leben lang.");
        var karlSpathII     = P(treeId, "Karl",      "Spath",        Sex.Male,   (1881,3,1),   (1944,6,6),   "Wien, Ottakring", null,        "Buchdrucker in einer Wiener Druckerei. Fiel im Zweiten Weltkrieg an der Ostfront.");
        var hildeZimmermann = P(treeId, "Hilde",     "Spath",        Sex.Female, (1886,9,17),  (1955,12,23), "Wien, Mariahilf",  "Zimmermann","Schneiderin in der Mariahilfer Straße. Zog vier Kinder allein großmit nach dem Tod von Karl.");

        // ── Generation III (born 1902–1918) ──────────────────────────────────
        var franzEscobarIII   = P(treeId, "Franz",     "Escobar",        Sex.Male,   (1908,9,22),  (1981,5,9),   "Innsbruck",       null,        "Tischler wie sein Vater. Diente 1943–45 an der Ostfront, kehrte traumatisiert zurück.");
        var annaSpathIII    = P(treeId, "Anna",      "Escobar",        Sex.Female, (1912,1,30),  (1990,7,18),  "Wien, Ottakring", "Spath",     "Kontoristin bei einer Wiener Versicherung bis zur Heirat 1935. Tochter des Buchdruckers Karl.");
        var karlEscobarIII    = P(treeId, "Karl",      "Escobar",        Sex.Male,   (1910,12,4),  (1975,3,21),  "Innsbruck",       null,        "Volksschullehrer in Innsbruck. Engagierter Chorleiter im Pfarrchor St. Jakob.");
        var emmiSmith      = P(treeId, "Emmi",      "Escobar",        Sex.Female, (1907,7,15),  (1980,10,2),  "Bregenz",         "Smith",    "Enkelin des Tuchhandelsmanns. Lernte Karl beim Volksfest in Innsbruck kennen.");
        var gertrudeEscobar   = P(treeId, "Gertrude",  "Huber",        Sex.Female, (1914,4,26),  (2001,8,14),  "Schwaz, Tirol",   "Escobar",     "Älteste Tochter von Alois und Rosa. Heiratete einen Salzburger Metzger. Wurde 87 Jahre alt.");
        var ernstHuber      = P(treeId, "Ernst",     "Huber",        Sex.Male,   (1906,2,11),  (1972,5,30),  "Salzburg",        null,        "Metzgermeister aus Salzburg. Eröffnete 1935 ein eigenes Geschäft in der Getreidegasse.");
        var alfredSmith    = P(treeId, "Alfred",    "Smith",       Sex.Male,   (1906,6,8),   (1969,9,19),  "Bregenz",         null,        "Uhrmacher wie sein Vater Otto. Gewann 1932 einen Preis für Präzisionsuhrmacherei in Wien.");
        var klaraSpath      = P(treeId, "Klara",     "Smith",       Sex.Female, (1916,3,25),  (1985,11,7),  "Wien, Ottakring", "Spath",     "Schwester von Anna. Zog nach Bregenz nach der Heirat mit Alfred 1940.");
        var idaSpath        = P(treeId, "Ida",       "Spath",        Sex.Female, (1918,10,12), (2004,1,3),   "Wien, Ottakring", null,        "Jüngste Tochter von Karl und Hilde. Blieb unverheiratet, arbeitete als Postbeamtin in Wien. Wurde 85 Jahre alt.");

        // ── Generation IV (born 1935–1948) ───────────────────────────────────
        var peterEscobar      = P(treeId, "Peter",     "Escobar",        Sex.Male,   (1940,3,4),   (2018,10,22), "Innsbruck",       null,        "Tischlermeister, führte den Familienbetrieb seines Vaters Franz bis zur Pensionierung 2005.");
        var heleneSmith    = P(treeId, "Helene",    "Escobar",        Sex.Female, (1944,8,15),  null,         "Bregenz",         "Smith",    "Tochter des Uhrmachers Alfred. Lebt seit 1968 in Innsbruck. Hobbymalerin.");
        var walterEscobar     = P(treeId, "Walter",    "Escobar",        Sex.Male,   (1937,11,17), (2010,2,6),   "Innsbruck",       null,        "Elektroingenieur bei der Österreichischen Post. Liebte das Bergsteigen.");
        var brigitteHuber   = P(treeId, "Brigitte",  "Escobar",        Sex.Female, (1943,5,29),  (2012,9,4),   "Salzburg",        "Huber",     "Tochter des Metzgermeisters Ernst Huber. Lernte Walter in Innsbruck kennen.");
        var erikaSmith     = P(treeId, "Erika",     "Spath",        Sex.Female, (1941,8,3),   (2015,4,17),  "Bregenz",         "Smith",    "Schwester von Helene. Zog nach Wien nach der Heirat mit Hans Spath 1963.");
        var hansSpath       = P(treeId, "Hans",      "Spath",        Sex.Male,   (1935,1,22),  (2019,7,8),   "Wien, Favoriten", null,        "Buchdrucker wie sein Großvater Karl. Leitete die Druckerei bis zu deren Schließung 1988.");
        var renateHuber     = P(treeId, "Renate",    "Huber",        Sex.Female, (1948,2,14),  null,         "Salzburg",        null,        "Jüngste Tochter von Ernst und Gertrude. Blieb ledig, ist Krankenschwester in Salzburg.");

        // ── Generation V (born 1966–2006) ────────────────────────────────────
        var thomasEscobar     = P(treeId, "Thomas",    "Escobar",        Sex.Male,   (1972,5,11),  null,         "Innsbruck",       null,        "Softwareentwickler. Zog 1995 nach Wien für die Arbeit bei einem Technologieunternehmen.");
        var lauraEscobar      = P(treeId, "Laura",     "Escobar",        Sex.Female, (1975,12,2),  null,         "Graz",            "Spath",     "Grazer Spath-Zweig, nicht direkt mit der Wiener Linie verwandt. Ärztin in Wien.");
        var claudiaEscobar    = P(treeId, "Claudia",   "Mair",         Sex.Female, (1969,3,8),   null,         "Innsbruck",       "Escobar",     "Übernahm das Maleratelier der Mutter Helene. Lebt in Innsbruck mit ihrem Mann Karl Mair.");
        var michaelEscobar    = P(treeId, "Michael",   "Escobar",        Sex.Male,   (1966,7,14),  null,         "Innsbruck",       null,        "Bergführer und Skilehrer am Stubaier Gletscher. Ältester Sohn von Walter und Brigitte.");
        var stefanEscobar     = P(treeId, "Stefan",    "Escobar",        Sex.Male,   (1968,9,25),  null,         "Innsbruck",       null,        "Koch, betreibt ein kleines Gasthaus in Innsbruck-Hötting. Jüngerer Bruder von Michael.");
        var martinaEscobar    = P(treeId, "Martina",   "Escobar",        Sex.Female, (1971,4,3),   null,         "Kufstein",        "Huber",     "Grundschullehrerin. Heiratete Stefan 1997, zog von Kufstein nach Innsbruck.");
        var felixSpath      = P(treeId, "Felix",     "Spath",        Sex.Male,   (1966,11,30), null,         "Wien, Favoriten", null,        "Grafikdesigner in einer Wiener Werbeagentur. Ältester Sohn von Hans und Erika.");
        var ninaSpath       = P(treeId, "Nina",      "Spath",        Sex.Female, (1970,6,22),  null,         "Wien, Favoriten", null,        "Lehrerin an einem Wiener Gymnasium, unterrichtet Deutsch und Geschichte.");
        var sophieEscobar     = P(treeId, "Sophie",    "Escobar",        Sex.Female, (2003,6,19),  null,         "Wien",            null,        "Schülerin, interessiert sich für Musik und Biologie.");
        var lukasEscobar      = P(treeId, "Lukas",     "Escobar",        Sex.Male,   (2006,1,7),   null,         "Wien",            null,        "Schüler, begeisterter Fußballspieler beim FC Wien-Floridsdorf.");

        db.Persons.AddRange(
            georgEscobar, theresiaEscobar, konradSmith, mariaSmithI,
            franzSpathI, annaSpathI, josephHuber, katharinaHuber,
            johannEscobar, marieSmith, aloisEscobar, rosaHuber,
            ottoSmith, eliseSpathII, karlSpathII, hildeZimmermann,
            franzEscobarIII, annaSpathIII, karlEscobarIII, emmiSmith,
            gertrudeEscobar, ernstHuber, alfredSmith, klaraSpath, idaSpath,
            peterEscobar, heleneSmith, walterEscobar, brigitteHuber,
            erikaSmith, hansSpath, renateHuber,
            thomasEscobar, lauraEscobar, claudiaEscobar, michaelEscobar,
            stefanEscobar, martinaEscobar, felixSpath, ninaSpath,
            sophieEscobar, lukasEscobar
        );

        // ── Marriages ────────────────────────────────────────────────────────
        Spouse(treeId, db, georgEscobar,    theresiaEscobar,  1870);
        Spouse(treeId, db, konradSmith,  mariaSmithI,   1872);
        Spouse(treeId, db, franzSpathI,   annaSpathI,     1874);
        Spouse(treeId, db, josephHuber,   katharinaHuber, 1876);

        Spouse(treeId, db, johannEscobar,   marieSmith,    1905);
        Spouse(treeId, db, aloisEscobar,    rosaHuber,      1908);
        Spouse(treeId, db, ottoSmith,    eliseSpathII,   1903);
        Spouse(treeId, db, karlSpathII,   hildeZimmermann,1910);

        Spouse(treeId, db, franzEscobarIII, annaSpathIII,   1935);
        Spouse(treeId, db, karlEscobarIII,  emmiSmith,     1933);
        Spouse(treeId, db, ernstHuber,    gertrudeEscobar,  1939);
        Spouse(treeId, db, alfredSmith,  klaraSpath,     1940);

        Spouse(treeId, db, peterEscobar,    heleneSmith,   1968);
        Spouse(treeId, db, walterEscobar,   brigitteHuber,  1965);
        Spouse(treeId, db, hansSpath,     erikaSmith,    1963);

        Spouse(treeId, db, thomasEscobar,   lauraEscobar,     2000);
        Spouse(treeId, db, stefanEscobar,   martinaEscobar,   1997);

        // ── Parent relationships ──────────────────────────────────────────────
        Parent(treeId, db, georgEscobar,    johannEscobar);
        Parent(treeId, db, theresiaEscobar, johannEscobar);
        Parent(treeId, db, georgEscobar,    aloisEscobar);
        Parent(treeId, db, theresiaEscobar, aloisEscobar);

        Parent(treeId, db, konradSmith,  marieSmith);
        Parent(treeId, db, mariaSmithI,  marieSmith);
        Parent(treeId, db, konradSmith,  ottoSmith);
        Parent(treeId, db, mariaSmithI,  ottoSmith);

        Parent(treeId, db, franzSpathI,   eliseSpathII);
        Parent(treeId, db, annaSpathI,    eliseSpathII);
        Parent(treeId, db, franzSpathI,   karlSpathII);
        Parent(treeId, db, annaSpathI,    karlSpathII);

        Parent(treeId, db, josephHuber,   rosaHuber);
        Parent(treeId, db, katharinaHuber,rosaHuber);

        Parent(treeId, db, johannEscobar,   franzEscobarIII);
        Parent(treeId, db, marieSmith,   franzEscobarIII);
        Parent(treeId, db, johannEscobar,   karlEscobarIII);
        Parent(treeId, db, marieSmith,   karlEscobarIII);

        Parent(treeId, db, aloisEscobar,    gertrudeEscobar);
        Parent(treeId, db, rosaHuber,     gertrudeEscobar);

        Parent(treeId, db, ottoSmith,    emmiSmith);
        Parent(treeId, db, eliseSpathII,  emmiSmith);
        Parent(treeId, db, ottoSmith,    alfredSmith);
        Parent(treeId, db, eliseSpathII,  alfredSmith);

        Parent(treeId, db, karlSpathII,   annaSpathIII);
        Parent(treeId, db, hildeZimmermann, annaSpathIII);
        Parent(treeId, db, karlSpathII,   klaraSpath);
        Parent(treeId, db, hildeZimmermann, klaraSpath);
        Parent(treeId, db, karlSpathII,   idaSpath);
        Parent(treeId, db, hildeZimmermann, idaSpath);

        Parent(treeId, db, franzEscobarIII, peterEscobar);
        Parent(treeId, db, annaSpathIII,  peterEscobar);

        Parent(treeId, db, karlEscobarIII,  walterEscobar);
        Parent(treeId, db, emmiSmith,    walterEscobar);

        Parent(treeId, db, ernstHuber,    renateHuber);
        Parent(treeId, db, gertrudeEscobar, renateHuber);

        Parent(treeId, db, alfredSmith,  heleneSmith);
        Parent(treeId, db, klaraSpath,    heleneSmith);
        Parent(treeId, db, alfredSmith,  erikaSmith);
        Parent(treeId, db, klaraSpath,    erikaSmith);

        Parent(treeId, db, peterEscobar,    thomasEscobar);
        Parent(treeId, db, heleneSmith,  thomasEscobar);
        Parent(treeId, db, peterEscobar,    claudiaEscobar);
        Parent(treeId, db, heleneSmith,  claudiaEscobar);

        Parent(treeId, db, walterEscobar,   michaelEscobar);
        Parent(treeId, db, brigitteHuber, michaelEscobar);
        Parent(treeId, db, walterEscobar,   stefanEscobar);
        Parent(treeId, db, brigitteHuber, stefanEscobar);

        Parent(treeId, db, hansSpath,     felixSpath);
        Parent(treeId, db, erikaSmith,   felixSpath);
        Parent(treeId, db, hansSpath,     ninaSpath);
        Parent(treeId, db, erikaSmith,   ninaSpath);

        Parent(treeId, db, thomasEscobar,   sophieEscobar);
        Parent(treeId, db, lauraEscobar,    sophieEscobar);
        Parent(treeId, db, thomasEscobar,   lukasEscobar);
        Parent(treeId, db, lauraEscobar,    lukasEscobar);

        // ── Extra timeline events ─────────────────────────────────────────────
        db.TimelineEvents.AddRange(
            // Gen I – Occupation
            EvtD(georgEscobar.Id,     TimelineEventType.Birth,      "Geburt",                             1845, 3, 12, "Schwaz, Tirol",         "Erstes Kind der Escobar-Familie."),
            EvtD(georgEscobar.Id,     TimelineEventType.Occupation, "Bergbauer und Zimmermann",           1865, null, null, "Schwaz, Tirol",     "Bewirtschaftete den Familienhof und baute 1869 das neue Wohnhaus."),
            EvtD(konradSmith.Id,   TimelineEventType.Occupation, "Tuchhandelsmann",                    1868, null, null, "Bregenz",           "Führte das Tuchgeschäft bis zur Übergabe an seinen Sohn 1900."),
            EvtD(franzSpathI.Id,    TimelineEventType.Occupation, "Schlosser in Fabrik",                1867, null, null, "Wien, Favoriten",   "Arbeitete in der Maschinenfabrik Simmeringer Haide."),
            EvtD(josephHuber.Id,    TimelineEventType.Occupation, "Bäckermeister",                      1872, null, null, "Salzburg",          "Eröffnete die Backstube in der Linzergasse."),

            // Gen II – Occupation, Education, Move
            EvtD(johannEscobar.Id,    TimelineEventType.Education,  "Tischlerlehre abgeschlossen",        1896, null, null, "Schwaz",            "Gesellenbrief bei Tischlermeister Maier."),
            EvtD(johannEscobar.Id,    TimelineEventType.Occupation, "Tischlergeselle",                    1898, null, null, "Innsbruck",         "Arbeitete beim Tischler Fischbacher in der Maria-Theresien-Straße."),
            EvtD(johannEscobar.Id,    TimelineEventType.Occupation, "Tischlerei Escobar gegründet",         1910, null, null, "Innsbruck",         "Eröffnete den eigenen Betrieb mit drei Gesellen."),
            EvtD(marieSmith.Id,    TimelineEventType.Move,       "Umzug nach Innsbruck",               1905, null, null, "Innsbruck",         "Zog nach der Heirat mit Johann nach Innsbruck."),
            EvtD(ottoSmith.Id,     TimelineEventType.Education,  "Uhrmacherlehre",                     1893, null, null, "Bregenz",           "Ausbildung beim renommierten Uhrmacher Häberle."),
            EvtD(ottoSmith.Id,     TimelineEventType.Occupation, "Uhrmacher – eigene Werkstatt",       1900, null, null, "Bregenz",           "Spezialisierte sich auf Präzisionsuhren und Taschenuhren."),
            EvtD(karlSpathII.Id,    TimelineEventType.Education,  "Buchdruckerlehre",                   1897, null, null, "Wien",              "Ausbildung in der Druckerei Rosenbaum."),
            EvtD(karlSpathII.Id,    TimelineEventType.Occupation, "Buchdrucker",                        1900, null, null, "Wien",              "Setzte Bücher und Zeitungen von Hand."),

            // Gen III – Education, Occupation, Move, Custom
            EvtD(franzEscobarIII.Id,  TimelineEventType.Education,  "Tischlerlehre",                      1924, null, null, "Innsbruck",         "Lernte das Handwerk im väterlichen Betrieb."),
            EvtD(franzEscobarIII.Id,  TimelineEventType.Occupation, "Tischlergeselle",                    1928, null, null, "Innsbruck",         "Übernahm Aufgaben im väterlichen Betrieb."),
            EvtD(franzEscobarIII.Id,  TimelineEventType.Move,       "Einberufung, Kriegsdienst",          1943, 4, null, "Ostfront",            "Wurde zur Deutschen Wehrmacht eingezogen."),
            EvtD(franzEscobarIII.Id,  TimelineEventType.Move,       "Rückkehr nach Innsbruck",            1945, 11, null, "Innsbruck",          "Kehrte traumatisiert aus der Kriegsgefangenschaft zurück."),
            EvtD(karlEscobarIII.Id,   TimelineEventType.Education,  "Lehrerausbildung abgeschlossen",     1933, null, null, "Innsbruck",         "Absolvierte die Lehrerbildungsanstalt in Innsbruck."),
            EvtD(karlEscobarIII.Id,   TimelineEventType.Occupation, "Volksschullehrer",                   1935, null, null, "Innsbruck",         "Unterrichtete an der Volksschule St. Nikolaus."),
            EvtD(karlEscobarIII.Id,   TimelineEventType.Custom,     "Chorleiter ernannt",                 1950, null, null, "Innsbruck",         "Übernahm die Leitung des Pfarrchors St. Jakob."),
            EvtD(ernstHuber.Id,     TimelineEventType.Education,  "Metzgerlehre",                       1923, null, null, "Salzburg",          "Ausbildung beim Metzgermeister Gruber."),
            EvtD(ernstHuber.Id,     TimelineEventType.Occupation, "Metzgermeister – eigenes Geschäft", 1935, null, null, "Salzburg, Getreidegasse", "Eröffnete das Geschäft in bester Innenstadtlage."),
            EvtD(alfredSmith.Id,   TimelineEventType.Education,  "Uhrmacherlehre",                     1922, null, null, "Bregenz",           "Lernte das Handwerk vom Vater Otto."),
            EvtD(alfredSmith.Id,   TimelineEventType.Occupation, "Uhrmacher",                          1925, null, null, "Bregenz",           "Übernahm schrittweise die Werkstatt des Vaters."),
            EvtD(alfredSmith.Id,   TimelineEventType.Custom,     "Preis für Präzisionsuhrmacherei",   1932, null, null, "Wien",              "Ausgezeichnet auf der Wiener Handwerksmesse."),

            // Gen IV – Education, Occupation, Move
            EvtD(peterEscobar.Id,     TimelineEventType.Education,  "Tischlerlehre",                      1956, null, null, "Innsbruck",         "Ausbildung im väterlichen Betrieb von Franz Escobar."),
            EvtD(peterEscobar.Id,     TimelineEventType.Occupation, "Tischlermeister",                    1965, null, null, "Innsbruck",         "Meisterprüfung und Übernahme des Betriebs."),
            EvtD(peterEscobar.Id,     TimelineEventType.Move,       "Umzug nach Innsbruck-Wilten",        1968, 9, null, "Innsbruck-Wilten",   "Neues Eigenheim mit Werkstatt im Souterrain."),
            EvtD(peterEscobar.Id,     TimelineEventType.Custom,     "Betrieb an Sohn übergeben",          2005, null, null, "Innsbruck",         "Verabschiedete sich nach 40 Jahren Selbstständigkeit in die Pension."),
            EvtD(walterEscobar.Id,    TimelineEventType.Education,  "Elektrotechnik-Studium",             1956, null, null, "Graz",              "Studierte an der TU Graz."),
            EvtD(walterEscobar.Id,    TimelineEventType.Occupation, "Elektroingenieur – Österr. Post",   1962, null, null, "Innsbruck",         "Leitete die Fernmeldetechnik für Nordtirol."),
            EvtD(walterEscobar.Id,    TimelineEventType.Custom,     "Erstbesteigung Großvenediger",       1970, 7, null, "Großvenediger",      "Sein größtes alpines Abenteuer mit der Bergführerkompanie."),
            EvtD(heleneSmith.Id,   TimelineEventType.Education,  "Kunstakademie",                      1963, null, null, "Wien",              "Studierte Malerei an der Akademie der bildenden Künste."),
            EvtD(heleneSmith.Id,   TimelineEventType.Move,       "Rückkehr nach Innsbruck",            1968, null, null, "Innsbruck",         "Kehrte nach der Heirat mit Peter nach Innsbruck zurück."),
            EvtD(hansSpath.Id,      TimelineEventType.Education,  "Buchdruckerlehre",                   1952, null, null, "Wien",              "Lehre in der väterlichen Druckerei."),
            EvtD(hansSpath.Id,      TimelineEventType.Occupation, "Buchdrucker",                        1955, null, null, "Wien",              "Übernahm die Leitung der Druckerei 1960."),
            EvtD(hansSpath.Id,      TimelineEventType.Custom,     "Druckerei geschlossen",              1988, null, null, "Wien",              "Das Aufkommen des Offsetdrucks machte den Handsatz unrentabel."),

            // Gen V – Education, Occupation, Move, Custom (richest for demo purposes)
            EvtD(thomasEscobar.Id,    TimelineEventType.Education,  "Abitur – Bundesrealgymnasium",       1990, 6, null, "Innsbruck",          "Mit Auszeichnung bestanden."),
            EvtD(thomasEscobar.Id,    TimelineEventType.Education,  "Informatik-Studium",                 1991, null, null, "Wien",              "Studierte an der TU Wien."),
            EvtD(thomasEscobar.Id,    TimelineEventType.Move,       "Umzug nach Wien",                    1991, 9, null, "Wien, Mariahilf",    "Erstes eigenes Studentenwohnen."),
            EvtD(thomasEscobar.Id,    TimelineEventType.Occupation, "Softwareentwickler",                 1998, null, null, "Wien",              "Entwickelte Webanwendungen für Finanzdienstleister."),
            EvtD(thomasEscobar.Id,    TimelineEventType.Move,       "Umzug nach Wien-Floridsdorf",        2001, 5, null, "Wien, Floridsdorf",  "Gemeinsam mit Laura und den Kindern."),
            EvtD(thomasEscobar.Id,    TimelineEventType.Custom,     "Firmengründung eigene GmbH",         2010, null, null, "Wien",              "Gründete eine eigene IT-Beratungsfirma."),
            EvtD(lauraEscobar.Id,     TimelineEventType.Education,  "Abitur",                             1993, 6, null, "Graz",               "Absolventin des BG Graz Keplerstraße."),
            EvtD(lauraEscobar.Id,     TimelineEventType.Education,  "Medizinstudium",                     1994, null, null, "Graz",              "Studierte Humanmedizin an der Uni Graz."),
            EvtD(lauraEscobar.Id,     TimelineEventType.Occupation, "Turnusärztin",                       2001, null, null, "Wien, AKH",         "Klinisches Jahr im Allgemeinen Krankenhaus Wien."),
            EvtD(lauraEscobar.Id,     TimelineEventType.Occupation, "Ärztin – Allgemeinmedizin",          2005, null, null, "Wien",              "Eröffnete eigene Praxis im 21. Bezirk."),
            EvtD(michaelEscobar.Id,   TimelineEventType.Education,  "Bergführer-Ausbildung",              1986, null, null, "Innsbruck",         "Ausbildung beim ÖAV Innsbruck."),
            EvtD(michaelEscobar.Id,   TimelineEventType.Occupation, "Bergführer und Skilehrer",           1988, null, null, "Stubaier Gletscher","Staatlich geprüfter Bergführer und Skilehrer."),
            EvtD(michaelEscobar.Id,   TimelineEventType.Custom,     "Erstbesteigung Cho Oyu",             1999, 5, null, "Cho Oyu, Tibet",     "Als Teil einer österreichischen Expedition bestiegen."),
            EvtD(stefanEscobar.Id,    TimelineEventType.Education,  "Kochausbildung",                     1987, null, null, "Innsbruck",         "Lehre im Hotel Adler am Brenner."),
            EvtD(stefanEscobar.Id,    TimelineEventType.Occupation, "Koch – Gasthausküche",               1991, null, null, "Innsbruck",         "Arbeitete in verschiedenen Innsbrucker Gastronomiebetrieben."),
            EvtD(stefanEscobar.Id,    TimelineEventType.Occupation, "Gasthaus Escobar eröffnet",            2005, 4, null, "Innsbruck-Hötting",  "Familienküche mit regionaler Tiroler Küche."),
            EvtD(felixSpath.Id,     TimelineEventType.Education,  "Graphik-Design-Studium",             1986, null, null, "Wien",              "FH für Kunst und Design Wien."),
            EvtD(felixSpath.Id,     TimelineEventType.Occupation, "Grafikdesigner",                     1990, null, null, "Wien",              "Arbeitete zuerst freelance, dann bei Agentur Rennweg."),
            EvtD(ninaSpath.Id,      TimelineEventType.Education,  "Germanistik und Geschichte",         1990, null, null, "Wien",              "Studium an der Universität Wien."),
            EvtD(ninaSpath.Id,      TimelineEventType.Occupation, "Lehrerin – Gymnasium",               1995, null, null, "Wien",              "BRG 21, Unterrichtsfächer Deutsch und Geschichte."),
            EvtD(sophieEscobar.Id,    TimelineEventType.Education,  "Schulbeginn – Volksschule",          2009, 9, null, "Wien, Floridsdorf",  "Floridsdorfer Volksschule Stutterheimgasse."),
            EvtD(sophieEscobar.Id,    TimelineEventType.Education,  "Gymnasium – Untergymnasium",         2013, 9, null, "Wien",               "BORG 21 Wien."),
            EvtD(lukasEscobar.Id,     TimelineEventType.Education,  "Schulbeginn – Volksschule",          2012, 9, null, "Wien, Floridsdorf",  "Floridsdorfer Volksschule Stutterheimgasse."),
            EvtD(lukasEscobar.Id,     TimelineEventType.Custom,     "Vereinsbeitritt FC Wien-Floridsdorf",2017, 4, null, "Wien",               "Spielte in der U12-Mannschaft.")
        );

        // ── Auto-generated marriage events ────────────────────────────────────
        MarriageEvents(treeId, db, georgEscobar,    theresiaEscobar,  1870);
        MarriageEvents(treeId, db, konradSmith,  mariaSmithI,   1872);
        MarriageEvents(treeId, db, franzSpathI,   annaSpathI,     1874);
        MarriageEvents(treeId, db, josephHuber,   katharinaHuber, 1876);
        MarriageEvents(treeId, db, johannEscobar,   marieSmith,    1905);
        MarriageEvents(treeId, db, aloisEscobar,    rosaHuber,      1908);
        MarriageEvents(treeId, db, ottoSmith,    eliseSpathII,   1903);
        MarriageEvents(treeId, db, karlSpathII,   hildeZimmermann,1910);
        MarriageEvents(treeId, db, franzEscobarIII, annaSpathIII,   1935);
        MarriageEvents(treeId, db, karlEscobarIII,  emmiSmith,     1933);
        MarriageEvents(treeId, db, ernstHuber,    gertrudeEscobar,  1939);
        MarriageEvents(treeId, db, alfredSmith,  klaraSpath,     1940);
        MarriageEvents(treeId, db, peterEscobar,    heleneSmith,   1968);
        MarriageEvents(treeId, db, walterEscobar,   brigitteHuber,  1965);
        MarriageEvents(treeId, db, hansSpath,     erikaSmith,    1963);
        MarriageEvents(treeId, db, thomasEscobar,   lauraEscobar,     2000);
        MarriageEvents(treeId, db, stefanEscobar,   martinaEscobar,   1997);
    }

    private static Person P(Guid treeId, string first, string last, Sex sex,
        (int y, int m, int d)? birth = null, (int y, int m, int d)? death = null,
        string? birthPlace = null, string? maiden = null, string? notes = null)
        => new()
        {
            TreeId = treeId, FirstName = first, LastName = last, MaidenName = maiden,
            Sex = sex,
            Birth = birth.HasValue ? new PartialDate(birth.Value.y, birth.Value.m, birth.Value.d) : null,
            Death = death.HasValue ? new PartialDate(death.Value.y, death.Value.m, death.Value.d) : null,
            BirthPlace = birthPlace,
            Notes = notes
        };

    private static TimelineEvent Evt(Guid personId, TimelineEventType type, string title,
        int year, int? month = null, string? location = null)
        => new() { PersonId = personId, Type = type, Title = title,
                   Start = new PartialDate(year, month, null), Location = location };

    private static TimelineEvent EvtD(Guid personId, TimelineEventType type, string title,
        int year, int? month, int? day, string? location, string? description = null)
        => new() { PersonId = personId, Type = type, Title = title,
                   Start = new PartialDate(year, month, day), Location = location, Description = description };

    private static void Spouse(Guid treeId, QsengDbContext db, Person a, Person b, int year)
        => db.Relationships.Add(new Relationship
        {
            TreeId = treeId, FromPersonId = a.Id, ToPersonId = b.Id,
            Type = RelationshipType.Spouse, StartYear = year
        });

    private static void Parent(Guid treeId, QsengDbContext db, Person parent, Person child)
        => db.Relationships.Add(new Relationship
        {
            TreeId = treeId, FromPersonId = parent.Id, ToPersonId = child.Id,
            Type = RelationshipType.Parent
        });

    private static void MarriageEvents(Guid treeId, QsengDbContext db, Person a, Person b, int year)
    {
        var rel = db.Relationships.Local.FirstOrDefault(r =>
            r.FromPersonId == a.Id && r.ToPersonId == b.Id && r.Type == RelationshipType.Spouse);
        if (rel is null) return;
        foreach (var personId in new[] { a.Id, b.Id })
            db.TimelineEvents.Add(new TimelineEvent
            {
                PersonId = personId, Type = TimelineEventType.Marriage, Title = "Hochzeit",
                Start = new PartialDate(year, null, null), IsAutoGenerated = true,
                SourceRelationshipId = rel.Id
            });
    }
}
