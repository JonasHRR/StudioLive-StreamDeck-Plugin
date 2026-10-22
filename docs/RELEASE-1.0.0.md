# StudioLive Control 1.0.0

Gemeinsamer Release für Windows und macOS vom 22. Oktober 2026. Stream Deck zeigt die Manifest-Version **1.0.0.0**.

## Enthalten

- Ein Installer für **Windows 10/11** und **macOS 13+**, mit **Stream Deck 7.1+**. Die Node.js-Laufzeit liefert Stream Deck mit.
- Mutes, Sends, Mute-Gruppen, Pegel und Fades mit Mixer-Rückmeldung, Namen, Farben und individuellen Tastenbelegungen.
- Neue **Level / Fade**-Tasten verwenden standardmäßig **Toggle fade −∞ / 0 dB** und **3 Sekunden** Übergangsdauer. Gespeicherte Aktionen und Dauern, einschließlich 0 Sekunden, bleiben erhalten.
- Die Mixer-IP wird unter Windows im bisherigen LOCALAPPDATA-Ordner und auf macOS unter `~/Library/Application Support/StudioLive-StreamDeck-Plugin/` gespeichert.

## Installation und Versionswechsel

ZIP entpacken und `de.local.studiolive-mutes.streamDeckPlugin` bei geöffneter Stream-Deck-App doppelklicken. Anschließend die Kategorie **StudioLive Control** öffnen und die Mixer-IP speichern. Windows und macOS verwenden dieselbe Datei.

Die Versionsnummer wird auf Wunsch des Projekteigentümers von den bisherigen Entwicklungsnummern auf **1.0.0** zurückgesetzt. Stream Deck kann die bisherige Testversion **1.9.4.1** bzw. andere höhere Entwicklungsstände als neuer ansehen; ein normales Update auf 1.0.0 ist daher nicht vorausgesetzt.

Vor dem Wechsel vorhandene Stream-Deck-Profile exportieren. Falls Stream Deck die Installation als Downgrade ablehnt, das bisherige Plugin über die Plugin-Verwaltung entfernen und danach 1.0.0 installieren. Bei Bedarf die gesicherten Profile wieder importieren. Plugin- und Action-UUIDs bleiben identisch. Die separat gespeicherte Mixer-IP wird vom Installer nicht mitgeliefert oder überschrieben; nach der Installation prüfen und bei Bedarf erneut speichern.

## Prüfumfang

Der Nutzer hat den vorausgehenden macOS-Testrelease auf seinem MacBook als einwandfrei funktionierend bestätigt. MacBook-Chip, macOS-Version und ein detailliertes Testprotokoll wurden nicht genannt. Daraus wird keine gesonderte Prüfung aller Intel-/Apple-Silicon-Modelle abgeleitet.

Automatisierte Prüfungen laufen unter Windows mit Node.js 22 und Stream Decks Node.js 20, einschließlich Simulatoren, SDK-Anbindung, Windows-/macOS-Speicherpfaden und neuen Level-Standardeinstellungen. Details stehen im [Testbericht](../TEST-REPORT.md); für weitere Mac-Checks gibt es die [Checkliste](MACOS-TEST.md).

Die dB-Skala bleibt näherungsweise. Reale 64S-Steuerbefehle und zusätzliche Eingänge sind weiterhin nicht vollständig durch Hardwaretests abgedeckt.

## Release-Dateien

- `de.local.studiolive-mutes.streamDeckPlugin`: gemeinsamer Installer.
- `StudioLive-Mutes-1.0.0-source.zip`: öffentlicher Quellcode mit Dokumentation und Lockfile.
- `RELEASE-1.0.0.md`: diese Hinweise.
- `SHA256SUMS.txt`: Prüfsummen für Installer, Quellcode und Hinweise.

Das Gesamtpaket heißt `StudioLive-Control-1.0.0.zip`. Es ist lokal erstellt; eine GitHub-Veröffentlichung erfolgt separat.
