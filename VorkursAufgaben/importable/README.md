# Importierbare Vorkurs-Aufgaben

Jede JSON-Datei entspricht dem Inhalt eines Kurs-Tabs. Jede nummerierte
Markdown-Aufgabe wird als eigenes Kapitel und damit als eigener Kartenstein
importiert. Schwierigkeitsgrad, Aufgabentyp und Aufgabenstellung bleiben
erhalten; Lösungen verbleiben ausschließlich in den Markdown-Quelldateien.
Noch leere Quellaufgaben werden ausdrücklich als Entwurf markiert.

| Datei | Empfohlener Tabname | Aufgaben/Kapitel |
| --- | --- | ---: |
| `woche-1/bruchrechenregeln.json` | Bruchrechenregeln | 14 |
| `woche-1/lineare-gleichungssysteme.json` | Lineare Gleichungssysteme | 13 |
| `woche-1/potenzgesetze.json` | Potenzgesetze | 22 |
| `woche-1/primzahlsatz.json` | Primzahlen und Teilbarkeit | 13 |
| `woche-1/quadratische-gleichungen.json` | Mitternachtsformel / p-q-Formel | 5 |
| `woche-1/wurzeln.json` | Wurzeln | 18 |
| `woche-1/zahlenbereiche-mengen.json` | Zahlenbereiche und Mengen | 16 |
| `woche-2/ableiten.json` | Ableitungsregeln | 26 |
| `woche-2/intergrale.json` | Integralrechenregeln | 23 |
| `woche-3/summen-und-produktzeichen.json` | Summen- und Produktzeichen | 9 |
| `raetsel.json` | Rätsel | 7 |

Die Dateien verwenden Version 1 des strikten Sokrates-JSON-Imports.
Erneute Generierung: `python3 VorkursAufgaben/convert_markdown_imports.py`.
