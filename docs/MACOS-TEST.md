# MacBook-Checkliste: StudioLive Control 1.0.0

Gemeinsamer Windows-/macOS-Release vom 22. Oktober 2026. In Stream Deck erscheint **1.0.0.0**. Der Nutzer hat den vorausgehenden Testrelease 1.9.4.1 auf seinem MacBook als einwandfrei funktionierend bestätigt. Details zu Chip und macOS-Version wurden nicht genannt. Hinweise zum Wechsel auf die niedrigere Release-Nummer stehen in den [Release-Hinweisen](RELEASE-1.0.0.md).

## Was für macOS geändert wurde

- Das Manifest erlaubt zusätzlich `mac` ab Version `13`; Stream Deck bleibt bei mindestens `7.1`.
- Die Mixer-IP wird auf dem Mac unter `~/Library/Application Support/StudioLive-StreamDeck-Plugin/mixer-settings.json` gespeichert. Der Windows-Speicherort bleibt erhalten.
- Beide Plattformen verwenden dasselbe JavaScript-Bundle und die von Stream Deck gelieferte Node.js-20-Laufzeit. Eine zusätzliche Node.js-Installation ist für die Nutzung nicht erforderlich. Es sind keine nativen Plugin-Binärdateien für Intel oder Apple Silicon enthalten.
- Plugin- und Action-UUIDs bleiben gleich. Es entsteht keine zweite Plugin-Kategorie. Für den Wechsel von einer höheren Entwicklungsnummer Profile sichern und die [Versionswechsel-Hinweise](RELEASE-1.0.0.md) beachten.
- Die SDK-Tests nutzen auch auf macOS ein temporäres Benutzerverzeichnis. Die eigentlichen Mixerbefehle wurden nicht geändert.

Offizielle Grundlagen: [Elgato-Manifest einschließlich macOS-Beispiel](https://docs.elgato.com/streamdeck/sdk/references/manifest/), [macOS-13-Anforderung seit Stream Deck 6.9](https://edge.elgato.com/egc/sd_content/releasenotes/6.9.0.html).

## Installation

1. Verwende ein MacBook mit **macOS 13 oder neuer**, Stream Deck **7.1 oder neuer** und einem angeschlossenen Stream Deck. Der erfolgreiche Nutzertest gilt für das getestete MacBook; getrennte Nachweise für Intel und Apple Silicon liegen nicht vor.
2. Übertrage `de.local.studiolive-mutes.streamDeckPlugin` aus dem Release auf das MacBook. Falls du das gesamte Release-ZIP verwendest, entpacke es zuerst.
3. Öffne Stream Deck und doppelklicke die Plugin-Datei. Bestätige die Installation bzw. Aktualisierung und prüfe die Version **1.0.0.0** in der Plugin-Verwaltung.
4. Suche die Kategorie **StudioLive Control**. Füge zunächst je eine Taste **Mute / Group / Send** und **Level / Fade** hinzu.
5. Verbinde das MacBook mit dem Kontrollnetz des Mixers. Trage dessen IPv4-Adresse ein, klicke **Save mixer IP for all buttons** und warte auf die Speicherbestätigung.
6. Wähle einen vorhandenen Kanal. Name, Farbe und Status sollten aus dem Mixer geladen werden. Öffnen und Konfigurieren einer Taste sendet noch keinen Steuerbefehl.

## Testablauf

Teste Steuerbefehle auf einem dafür geeigneten Kanal und notiere das Ergebnis. Prüfe jeweils die Rückmeldung am Mixer und auf dem Stream Deck.

| Test | Erwartetes Ergebnis |
|---|---|
| Installation und Start | Version 1.0.0.0, beide Aktionen sichtbar, keine dauerhaft leeren Tasten. |
| Einstellungen öffnen | Kanal-/Zielauswahl, Namen, Farben und Hilfetexte werden korrekt angezeigt. |
| IP speichern | Speicherbestätigung; eine neu angelegte Taste verwendet dieselbe Adresse. |
| Stream Deck vollständig beenden und neu starten | IP und Belegungen bleiben erhalten; Verbindung wird wieder aufgebaut. |
| Vorhandene IP durch erneutes Speichern ersetzen | Neue Adresse bleibt nach Neustart erhalten; danach ursprüngliche Adresse wieder speichern. |
| Mute umschalten | Mixer und Taste zeigen denselben Zustand; Mute am Mixer ändern und externe Rückmeldung prüfen. |
| Festen Pegel und relativen Schritt ausführen | Mixer erreicht den gewählten Pegel; Anzeige folgt der Rückmeldung. dB-Werte bleiben Näherungen. |
| Fade, Toggle-Fade und Stop | Fade läuft über die eingestellte Dauer, lässt sich umkehren bzw. stoppen. |
| Netzverbindung kurz trennen und wiederherstellen | OFFLINE, anschließend automatische Wiederverbindung. Offline-Tastendrücke werden nicht nachgesendet. |
| Weitere Ziele nach Bedarf | Mix bus, vorhandene Mute-Gruppen, Sends und zusätzliche Eingänge prüfen, soweit der Mixer Rückmeldung liefert. |
| Optional: MacBook-Ruhezustand und Aufwachen | Nach Wiederherstellung des Netzes verbindet sich das Plugin erneut. |

## Wenn die Verbindung fehlt

- Prüfe die tatsächliche Mixer-IP und die Erreichbarkeit des Kontrollnetzes auf TCP-Port **53000**.
- Falls macOS eine lokale Netzwerkberechtigung anfragt, erlaube sie für die angezeigte Stream-Deck-Anwendung. Prüfe bei Bedarf **Systemeinstellungen → Datenschutz & Sicherheit → Lokales Netzwerk**, sofern diese Einstellung vorhanden ist. [Apple-Anleitung](https://support.apple.com/guide/mac-help/control-access-to-your-local-network-on-mac-mchla4f49138/mac).
- Die IP-Datei lässt sich im Finder mit **Gehe zu → Gehe zum Ordner** über `~/Library/Application Support/StudioLive-StreamDeck-Plugin/` finden. Nach erfolgreichem Speichern sollte dort `mixer-settings.json` stehen.
- Plugin-Logs liegen normalerweise unter `~/Library/Application Support/com.elgato.StreamDeck/Plugins/de.local.studiolive-mutes.sdPlugin/logs/`. Falls vorhanden, Fehlertexte zusammen mit dem Testschritt notieren. Vor Weitergabe persönliche Pfade und Mixer-IP entfernen.

## Rückmeldung

```text
MacBook-Modell / Chip (Intel, M1, M2, ...):
macOS-Version:
Stream-Deck-App-Version / Hardware-Modell:
Plugin-Version: 1.0.0.0
Mixer-Modell / Firmware:
Installation und Einstellungen:
IP speichern / erneutes Speichern / Neustart:
Mute / externer Status / Pegel / Fade / Stop:
Verbindung nach Netzunterbrechung / Ruhezustand:
Auffälligkeiten mit genauen Schritten / Fehlertext:
```

## Prüfstatus

Der Release wird unter Windows gebaut und gegen Simulatoren geprüft. Die automatisierten Pfadtests prüfen Windows und macOS, einschließlich Leerzeichen und Umlauten im Mac-Benutzernamen, ohne einen Mac zu simulieren. Der Nutzer hat den vorherigen Testrelease auf seinem MacBook als einwandfrei funktionierend bestätigt. Das ist ein Nutzertest ohne detailliertes Protokoll und keine Prüfung aller Mac-Modelle oder OS-Versionen. Die endgültige Version 1.0.0 mit geändertem Level-Standard wurde automatisiert unter Windows geprüft; eine separate Mac-Nachprüfung dieser letzten Änderung ist noch nicht dokumentiert.
