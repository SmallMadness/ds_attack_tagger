// ==UserScript==
// @name         Tribal Wars - Attack Tagger
// @version      1.0
// @description  Schnelles Umbenennen von Angriffen mit vordefinierten Werten
// @author       Big Madness
// @match        https://*.die-staemme.de/game.php?*screen=overview_villages*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/SmallMadness/ds_attack_tagger/refs/heads/main/attack_tagger.js
// @downloadURL  https://raw.githubusercontent.com/SmallMadness/ds_attack_tagger/refs/heads/main/attack_tagger.js
// ==/UserScript==

(function() {
    'use strict';

    // KONFIGURATION: Hier die Button-Werte definieren
    let TAG_BUTTONS = [
        { label: '!', value: '!', tooltip: 'Rausstellen', multiple: false, shortcut: '1' },
        { label: '*', value: '*', tooltip: 'Eigene Deff', multiple: false, shortcut: '2' },
        { label: '*S', value: '*S', tooltip: 'Stammes-Deff', multiple: false, shortcut: '3' },
        { label: 'X', value: 'X', tooltip: 'Getroffen', multiple: false, shortcut: '4' },
        { label: 'F', value: 'F', tooltip: 'Fake', multiple: false, shortcut: '5' },
        { label: '?', value: '?', tooltip: 'Unbekannt', multiple: false, shortcut: '6' }
    ];

    // Globale Einstellung: Tags vor dem Namen einfügen
    let TAG_BEFORE_NAME = false;

    // Tracking für Änderungen
    let hasChanges = false;
    let saveButtonElement = null;

    // Lade gespeicherte Einstellungen
    const savedButtons = localStorage.getItem('attack_tagger_buttons');
    if (savedButtons) {
        try {
            TAG_BUTTONS = JSON.parse(savedButtons);
        } catch (e) {
            console.error('Fehler beim Laden der Einstellungen:', e);
        }
    }

    const savedTagBefore = localStorage.getItem('attack_tagger_before');
    if (savedTagBefore !== null) {
        TAG_BEFORE_NAME = savedTagBefore === 'true';
    }

    // Warte bis die Seite vollständig geladen ist
    function waitForElement(selector, callback, maxAttempts = 50) {
        let attempts = 0;
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(interval);
                callback(element);
            } else if (++attempts >= maxAttempts) {
                clearInterval(interval);
            }
        }, 100);
    }

    // Starte nach vollständigem Laden
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // Warte auf den Filter-Link
        waitForElement('a.overview_filters_manage', (filterLink) => {
            createTagButtonBar(filterLink);
            
            // Überwache Klicks auf den Filter-Link
            filterLink.addEventListener('click', () => {
                setTimeout(() => {
                    addTagBoxToFilterDialog();
                }, 300);
            });

            // Prüfe regelmäßig ob das Filter-Formular existiert (z.B. nach Reload)
            setInterval(() => {
                const filterForm = document.querySelector('form[action*="save_filters"]');
                if (filterForm && !document.getElementById('tag_filter_box')) {
                    addTagBoxToFilterDialog();
                }
            }, 500);
        });
    }

    function updateSaveButtonState() {
        if (saveButtonElement) {
            if (hasChanges) {
                saveButtonElement.style.backgroundColor = '#90EE90';
                saveButtonElement.style.cursor = 'pointer';
                saveButtonElement.style.opacity = '1';
                saveButtonElement.disabled = false;
            } else {
                saveButtonElement.style.backgroundColor = '#cccccc';
                saveButtonElement.style.cursor = 'not-allowed';
                saveButtonElement.style.opacity = '0.5';
                saveButtonElement.disabled = true;
            }
        }
    }

    function createTagButtonBar(filterLink) {
        // Erstelle Haupt-Container
        const mainContainer = document.createElement('div');
        mainContainer.style.cssText = `
            margin: 10px 0;
            padding: 3px;
            background-color: #f4e4bc;
            border: 1px solid #7d510f;
            border-radius: 4px;
            display: flex;
            gap: 8px;
            align-items: flex-start;
        `;

        // Label hinzufügen
        const label = document.createElement('span');
        label.textContent = 'Tags:';
        label.style.fontWeight = 'bold';
        label.style.marginTop = '4px';
        mainContainer.appendChild(label);

        // Container für die Buttons (mit wrap)
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 3px;
            align-items: center;
            flex-wrap: wrap;
            flex: 1;
        `;
        mainContainer.appendChild(buttonContainer);

        // Buttons erstellen
        TAG_BUTTONS.forEach(btn => {
            if (btn.isSeparator) {
                // Zeilenumbruch: Erzwinge neue Zeile ohne sichtbare Linie
                const separator = document.createElement('div');
                separator.style.cssText = `
                    width: 100%;
                    height: 0;
                `;
                buttonContainer.appendChild(separator);
            } else {
                const button = document.createElement('button');
                button.textContent = btn.label;
                button.className = 'btn';
                button.title = btn.tooltip; // Tooltip beim Hover
                button.style.cssText = `
                    padding: 4px 10px;
                    cursor: pointer;
                    min-width: 35px;
                    font-weight: bold;
                `;

                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    tagSelectedAttacks(btn.value, btn.multiple);
                    hasChanges = true;
                    updateSaveButtonState();
                });

                buttonContainer.appendChild(button);
            }
        });

        // Settings Button
        const settingsButton = document.createElement('button');
        settingsButton.textContent = '⚙️';
        settingsButton.title = 'Einstellungen'; // Tooltip
        settingsButton.className = 'btn';
        settingsButton.style.cssText = `
            padding: 4px 10px;
            cursor: pointer;
            margin-left: auto;
        `;
        settingsButton.addEventListener('click', (e) => {
            e.preventDefault();
            showSettings();
        });
        mainContainer.appendChild(settingsButton);

        // Button zum Entfernen von Tags
        const removeButton = document.createElement('button');
        removeButton.textContent = '❌';
        removeButton.title = 'Tags entfernen'; // Tooltip
        removeButton.className = 'btn';
        removeButton.style.cssText = `
            padding: 4px 10px;
            cursor: pointer;
            background-color: #ffcccc;
        `;
        removeButton.addEventListener('click', (e) => {
            e.preventDefault();
            removeTagsFromSelected();
            hasChanges = true;
            updateSaveButtonState();
        });
        mainContainer.appendChild(removeButton);

        // Speichern Button
        const saveButton = document.createElement('button');
        saveButton.textContent = '💾';
        saveButton.title = 'Änderungen speichern'; // Tooltip
        saveButton.className = 'btn';
        saveButton.style.cssText = `
            padding: 4px 10px;
            cursor: not-allowed;
            background-color: #cccccc;
            font-weight: bold;
            opacity: 0.5;
        `;
        saveButton.disabled = true;
        saveButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (hasChanges) {
                saveAllSelected();
            }
        });
        mainContainer.appendChild(saveButton);

        // Speichere Referenz zum Save Button
        saveButtonElement = saveButton;

        // Füge die Button-Leiste direkt nach dem Filter-Link ein
        filterLink.parentNode.insertBefore(mainContainer, filterLink.nextSibling);

        // Keyboard Shortcuts aktivieren
        setupKeyboardShortcuts();
    }

    async function tagSelectedAttacks(tagValue, isMultiple) {
        // Finde alle markierten Checkboxen (name="id_XXXXXX")
        let checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');

        // Filtere nur die Angriffs-Checkboxen
        checkboxes = Array.from(checkboxes).filter(cb => {
            const name = cb.getAttribute('name');
            return name && name.startsWith('id_');
        });

        if (checkboxes.length === 0) {
            alert('Bitte wähle mindestens einen Angriff aus!');
            return;
        }

        let count = 0;

        // Verarbeite sequenziell mit async/await
        for (const checkbox of checkboxes) {
            const row = checkbox.closest('tr');
            if (!row) continue;

            const quickedit = row.querySelector('.quickedit');
            if (!quickedit) continue;

            const commandId = quickedit.getAttribute('data-id');
            if (!commandId) continue;

            const labelSpan = quickedit.querySelector('.quickedit-label');
            if (!labelSpan) continue;

            const currentName = labelSpan.textContent.trim();

            let newName;
            if (isMultiple) {
                // Mehrfach: Füge Tag hinzu ohne bestehende zu entfernen
                if (TAG_BEFORE_NAME) {
                    newName = `[${tagValue}] ${currentName}`;
                } else {
                    newName = `${currentName} [${tagValue}]`;
                }
            } else {
                // Einmalig: Entferne existierende Tags und ersetze
                const nameWithoutTags = currentName.replace(/\s*\[.*?\]\s*/g, '').trim();
                if (TAG_BEFORE_NAME) {
                    newName = `[${tagValue}] ${nameWithoutTags}`;
                } else {
                    newName = `${nameWithoutTags} [${tagValue}]`;
                }
            }

            labelSpan.textContent = newName;
            count++;
        }

        if (count > 0) {
            showNotification(`${count} Angriff(e) mit [${tagValue}] getaggt`);
        } else {
            alert('Keine Namensfelder gefunden. Bitte öffne die Konsole (F12) für Details.');
        }
    }

    async function saveAllSelected() {
        // Finde alle markierten Checkboxen
        let checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');

        // Filtere nur die Angriffs-Checkboxen
        checkboxes = Array.from(checkboxes).filter(cb => {
            const name = cb.getAttribute('name');
            return name && name.startsWith('id_');
        });

        if (checkboxes.length === 0) {
            alert('Bitte wähle mindestens einen Angriff aus!');
            return;
        }

        let count = 0;

        // Verarbeite sequenziell
        for (const checkbox of checkboxes) {
            const row = checkbox.closest('tr');
            if (!row) continue;

            // Finde den Umbenennen-Link
            const renameLink = row.querySelector('a.rename-icon');
            if (!renameLink) continue;

            // Klicke auf den Umbenennen-Link (aktiviert das Edit-Feld)
            renameLink.click();

            // Warte bis der Button sichtbar wird
            let submitButton = null;
            let attempts = 0;
            const maxAttempts = 30; // 30 * 100ms = 3 Sekunden

            while (!submitButton && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));

                // Suche den Button in der quickedit-edit Span
                const quickeditEdit = row.querySelector('.quickedit-edit');

                if (quickeditEdit) {
                    // Prüfe ob der Button sichtbar ist
                    const style = window.getComputedStyle(quickeditEdit);
                    if (style.display !== 'none') {
                        submitButton = quickeditEdit.querySelector('input[type="button"][value="Umbenennen"]');
                    }
                }

                attempts++;
            }

            if (submitButton) {
                // Kurzer Delay vor dem Klick
                await new Promise(resolve => setTimeout(resolve, 150));

                // Klicke auf den Umbenennen-Button
                submitButton.click();

                // Warte bis das Popup geschlossen wird
                await new Promise(resolve => setTimeout(resolve, 400));
            }

            count++;
        }

        if (count > 0) {
            showNotification(`${count} Angriff(e) gespeichert`);
            // Setze hasChanges zurück nach erfolgreichem Speichern
            hasChanges = false;
            updateSaveButtonState();
        }
    }

    async function removeTagsFromSelected() {
        let checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');

        // Filtere nur die Angriffs-Checkboxen
        checkboxes = Array.from(checkboxes).filter(cb => {
            const name = cb.getAttribute('name');
            return name && name.startsWith('id_');
        });

        if (checkboxes.length === 0) {
            alert('Bitte wähle mindestens einen Angriff aus!');
            return;
        }

        let count = 0;

        // Verarbeite sequenziell mit async/await
        for (const checkbox of checkboxes) {
            const row = checkbox.closest('tr');
            if (!row) continue;

            const quickedit = row.querySelector('.quickedit');
            if (!quickedit) continue;

            const labelSpan = quickedit.querySelector('.quickedit-label');
            if (!labelSpan) continue;

            // Entferne alle Tags in eckigen Klammern
            const currentName = labelSpan.textContent.trim();
            const newName = currentName.replace(/\s*\[.*?\]\s*/g, '').trim();

            labelSpan.textContent = newName;
            count++;
        }

        if (count > 0) {
            showNotification(`Tags von ${count} Angriff(en) entfernt`);
        }
    }

    function addTagBoxToFilterDialog() {
        // Finde das Formular mit der action="save_filters"
        const filterForm = document.querySelector('form[action*="save_filters"]');
        if (!filterForm) return;

        const filterTable = filterForm.querySelector('table.vis');
        if (!filterTable) return;

        if (document.getElementById('tag_filter_box')) return;

        const commandInput = filterForm.querySelector('input[name="filters[target_comment]"]');
        if (!commandInput) return;

        // Erstelle einen Wrapper-Div für Filter-Tabelle und Tag-Boxen
        const wrapper = document.createElement('div');
        wrapper.id = 'tag_filter_box';
        wrapper.style.cssText = 'display: flex; gap: 10px; align-items: flex-start;';
        
        // Füge den Wrapper vor der Filter-Tabelle ein (aber innerhalb des Forms)
        filterTable.parentNode.insertBefore(wrapper, filterTable);
        wrapper.appendChild(filterTable);

        // Gruppiere Buttons nach Separatoren
        const buttonGroups = [[]];
        TAG_BUTTONS.forEach(btn => {
            if (btn.isSeparator) {
                // Neue Gruppe starten
                buttonGroups.push([]);
            } else {
                // Button zur aktuellen Gruppe hinzufügen
                buttonGroups[buttonGroups.length - 1].push(btn);
            }
        });

        // Erstelle für jede Gruppe eine eigene Spalte
        buttonGroups.forEach((group, groupIndex) => {
            if (group.length === 0) return; // Leere Gruppen überspringen

            const tagBox = document.createElement('table');
            tagBox.className = 'vis';
            tagBox.style.cssText = `
                margin-left: 10px;
                vertical-align: top;
            `;

            tagBox.innerHTML = `
                <tr>
                    <th>${groupIndex === 0 ? 'Schnellfilter nach Tags' : '&nbsp;'}</th>
                </tr>
                <tr>
                    <td style="padding: 10px;">
                        <div class="tag_filter_buttons_group" style="display: flex; flex-direction: column; gap: 5px;">
                        </div>
                    </td>
                </tr>
            `;

            wrapper.appendChild(tagBox);

            // Füge Buttons zur Gruppe hinzu
            const buttonContainer = tagBox.querySelector('.tag_filter_buttons_group');
            group.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = `[${btn.label}] ${btn.tooltip}`;
                button.className = 'btn';
                button.style.cssText = `
                    padding: 5px 10px;
                    cursor: pointer;
                    width: 100%;
                    text-align: left;
                `;

                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    commandInput.value = `[${btn.label}]`;
                    commandInput.focus();
                    showNotification(`Filter auf [${btn.label}] gesetzt`);
                });

                buttonContainer.appendChild(button);
            });

            // Füge "Filter leeren" Button nur zur letzten Gruppe hinzu
            if (groupIndex === buttonGroups.length - 1) {
                const clearButton = document.createElement('button');
                clearButton.textContent = '🗑️ Filter leeren';
                clearButton.className = 'btn';
                clearButton.style.cssText = `
                    padding: 5px 10px;
                    cursor: pointer;
                    width: 100%;
                    background-color: #ffcccc;
                    margin-top: 5px;
                `;
                clearButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    commandInput.value = '';
                    commandInput.focus();
                });
                buttonContainer.appendChild(clearButton);
            }
        });
    }

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignoriere Shortcuts wenn in einem Input-Feld
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Finde den Button mit dem passenden Shortcut
            const button = TAG_BUTTONS.find(btn => btn.shortcut && btn.shortcut.toLowerCase() === e.key.toLowerCase());
            
            if (button) {
                e.preventDefault();
                tagSelectedAttacks(button.value, button.multiple);
                hasChanges = true;
                updateSaveButtonState();
                showNotification(`Tag [${button.value}] angewendet (Shortcut: ${button.shortcut})`);
            }
        });
    }

    function showNotification(message) {
        // Erstelle eine temporäre Benachrichtigung
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background-color: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
        `;

        document.body.appendChild(notification);

        // Entferne nach 3 Sekunden
        setTimeout(() => {
            notification.style.transition = 'opacity 0.5s';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    function showHelp() {
        const helpOverlay = document.createElement('div');
        helpOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 10001;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const helpDialog = document.createElement('div');
        helpDialog.style.cssText = `
            background-color: #f4e4bc;
            border: 2px solid #7d510f;
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;

        helpDialog.innerHTML = `
            <h3 style="margin-top: 0; color: #7d510f; text-align: center;">📚 Attack Tagger - Hilfe</h3>
            
            <h4 style="color: #7d510f; margin-top: 15px;">🎯 Was macht dieses Script?</h4>
            <p>Der Attack Tagger ermöglicht es dir, eingehende Angriffe schnell und einfach mit Tags zu versehen, um sie besser zu organisieren und zu filtern.</p>
            
            <h4 style="color: #7d510f; margin-top: 15px;">🚀 Hauptfunktionen:</h4>
            <ul style="line-height: 1.6;">
                <li><strong>Tags vergeben:</strong> Wähle Angriffe aus (Checkboxen) und klicke auf einen Tag-Button</li>
                <li><strong>Keyboard Shortcuts:</strong> Nutze Tastenkombinationen für noch schnelleres Taggen</li>
                <li><strong>Speichern:</strong> Der 💾-Button wird aktiv wenn Änderungen vorliegen</li>
                <li><strong>Tags entfernen:</strong> ❌-Button entfernt alle Tags von ausgewählten Angriffen</li>
                <li><strong>Filtern:</strong> Nutze "Filter verwalten" um nur Angriffe mit bestimmten Tags anzuzeigen</li>
            </ul>
            
            <h4 style="color: #7d510f; margin-top: 15px;">⚙️ Einstellungen:</h4>
            <ul style="line-height: 1.6;">
                <li><strong>Beschreibung:</strong> Name des Tags (wird im Tooltip angezeigt)</li>
                <li><strong>Symbol:</strong> Das Zeichen das im Tag verwendet wird (z.B. !, *, F)</li>
                <li><strong>Shortcut:</strong> Tastenkombination zum schnellen Taggen (z.B. 1, 2, 3)</li>
                <li><strong>Mehrfach:</strong> Wenn aktiviert, werden Tags hinzugefügt statt ersetzt</li>
                <li><strong>Position:</strong> Tags vor oder nach dem Befehls-Namen einfügen</li>
                <li><strong>Sortieren:</strong> Ziehe die Zeilen mit ⋮⋮ um die Reihenfolge zu ändern</li>
            </ul>
            
            <h4 style="color: #7d510f; margin-top: 15px;">📝 Workflow-Beispiel:</h4>
            <ol style="line-height: 1.6;">
                <li>Angriffe auswählen (Checkboxen anklicken)</li>
                <li>Tag-Button klicken oder Shortcut-Taste drücken (z.B. "5" für Fake)</li>
                <li>Speicher-Button wird aktiv → auf 💾 klicken zum Speichern</li>
                <li>"Filter verwalten" öffnen und Tag im Befehl-Feld eingeben (z.B. [F])</li>
                <li>Nur Angriffe mit diesem Tag werden angezeigt</li>
            </ol>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #7d510f;">
            <p style="text-align: center; color: #7d510f; font-size: 12px; margin: 10px 0;">
                <strong>📜 Big Madness</strong>
            </p>

            <div style="margin-top: 15px; text-align: center;">
                <button class="btn" id="help_close" style="padding: 8px 20px;">Schließen</button>
            </div>
        `;

        helpOverlay.appendChild(helpDialog);
        document.body.appendChild(helpOverlay);

        // Event Listener
        document.getElementById('help_close').addEventListener('click', () => {
            helpOverlay.remove();
        });

        helpOverlay.addEventListener('click', (e) => {
            if (e.target === helpOverlay) {
                helpOverlay.remove();
            }
        });
    }

    function showSettings() {
        // Erstelle Settings-Dialog
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background-color: #f4e4bc;
            border: 2px solid #7d510f;
            border-radius: 8px;
            padding: 20px;
            max-width: 450px;
            width: 90%;
            position: relative;
        `;

        dialog.innerHTML = `
            <span id="help_button" style="position: absolute; top: 8px; right: 8px; cursor: pointer; font-size: 18px; user-select: none; line-height: 1; color: #000;" title="Hilfe anzeigen">❓</span>
            <h3 style="margin: 0 0 10px 0; color: #7d510f;">Tag-Einstellungen</h3>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <p style="margin: 0;">Hier kannst du die Tags anpassen:</p>
                <div style="white-space: nowrap;">
                    <label>
                        <input type="radio" name="tag_position" value="before" ${TAG_BEFORE_NAME ? 'checked' : ''}>
                        Name
                    </label>
                    <label style="margin-right: 10px;">
                        <input type="radio" name="tag_position" value="after" ${!TAG_BEFORE_NAME ? 'checked' : ''}>
                    </label>
                </div>
            </div>
            <table id="tags_table" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <th style="text-align: center; padding: 5px; width: 30px;"></th>
                    <th style="text-align: left; padding: 5px;">Beschreibung</th>
                    <th style="text-align: left; padding: 5px; width: 80px;">Symbol</th>
                    <th style="text-align: center; padding: 5px; width: 80px;">Shortcut</th>
                    <th style="text-align: center; padding: 5px; width: 80px;">Mehrfach</th>
                    <th style="text-align: center; padding: 5px; width: 50px;">Löschen</th>
                </tr>
                ${TAG_BUTTONS.map((btn, index) => `
                    <tr data-index="${index}" class="sortable-row">
                        <td style="padding: 5px; text-align: center;">
                            <div class="bqhandle" style="cursor: move; font-size: 16px;" title="Ziehen zum Verschieben">⋮⋮</div>
                        </td>
                        <td style="padding: 5px;">
                            ${btn.isSeparator ? '<strong style="color: #7d510f;">Trennlinie</strong>' : `<input type="text" value="${btn.tooltip}" id="tooltip_${index}" style="width: 100%;">`}
                        </td>
                        <td style="padding: 5px;">
                            ${btn.isSeparator ? '' : `<input type="text" value="${btn.label}" id="label_${index}" style="width: 100%;">`}
                        </td>
                        <td style="padding: 5px; text-align: center;">
                            ${btn.isSeparator ? '' : `<input type="text" value="${btn.shortcut || ''}" id="shortcut_${index}" style="width: 100%; text-align: center;" maxlength="1" placeholder="-">`}
                        </td>
                        <td style="padding: 5px; text-align: center;">
                            ${btn.isSeparator ? '' : `<input type="checkbox" id="multiple_${index}" ${btn.multiple ? 'checked' : ''}>`}
                        </td>
                        <td style="padding: 5px; text-align: center;"><button class="btn btn-delete" data-index="${index}" style="padding: 2px 8px; background-color: #ffcccc;">🗑️</button></td>
                    </tr>
                `).join('')}
            </table>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button class="btn" id="add_tag_button">+ Neuer Tag</button>
                <button class="btn" id="add_separator_button">+ Trennlinie</button>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button class="btn" id="settings_cancel" style="margin-right: 10px;">Abbrechen</button>
                <button class="btn" id="settings_save">Speichern</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        let tagCounter = TAG_BUTTONS.length;

        // Event Listeners
        document.getElementById('help_button').addEventListener('click', (e) => {
            e.preventDefault();
            showHelp();
        });

        document.getElementById('settings_cancel').addEventListener('click', () => {
            overlay.remove();
        });

        // Initialisiere Drag & Drop mit jQuery UI Sortable
        $('#tags_table').sortable({
            items: 'tr.sortable-row',
            handle: '.bqhandle',
            axis: 'y',
            cursor: 'move',
            placeholder: 'ui-state-highlight',
            helper: function(e, tr) {
                const $originals = tr.children();
                const $helper = tr.clone();
                $helper.children().each(function(index) {
                    $(this).width($originals.eq(index).width());
                });
                return $helper;
            },
            start: function(e, ui) {
                ui.placeholder.height(ui.item.height());
                ui.placeholder.css('background-color', '#ffffcc');
            }
        });

        // Trennlinie hinzufügen
        document.getElementById('add_separator_button').addEventListener('click', () => {
            const table = document.getElementById('tags_table');
            const newRow = document.createElement('tr');
            newRow.setAttribute('data-index', tagCounter);
            newRow.setAttribute('data-separator', 'true');
            newRow.className = 'sortable-row';
            newRow.innerHTML = `
                <td style="padding: 5px; text-align: center;">
                    <div class="bqhandle" style="cursor: move; font-size: 16px;" title="Ziehen zum Verschieben">⋮⋮</div>
                </td>
                <td colspan="4" style="padding: 5px;">
                    <strong style="color: #7d510f;">── Trennlinie ──</strong>
                </td>
                <td style="padding: 5px; text-align: center;"><button class="btn btn-delete" data-index="${tagCounter}" style="padding: 2px 8px; background-color: #ffcccc;">🗑️</button></td>
            `;
            table.appendChild(newRow);

            // Event Listener für den neuen Löschen-Button
            newRow.querySelector('.btn-delete').addEventListener('click', function() {
                this.closest('tr').remove();
            });

            // Refresh sortable nach dem Hinzufügen
            $('#tags_table').sortable('refresh');

            tagCounter++;
        });

        // Neuen Tag hinzufügen
        document.getElementById('add_tag_button').addEventListener('click', () => {
            const table = document.getElementById('tags_table');
            const newRow = document.createElement('tr');
            newRow.setAttribute('data-index', tagCounter);
            newRow.className = 'sortable-row';
            newRow.innerHTML = `
                <td style="padding: 5px; text-align: center;">
                    <div class="bqhandle" style="cursor: move; font-size: 16px;" title="Ziehen zum Verschieben">⋮⋮</div>
                </td>
                <td style="padding: 5px;"><input type="text" value="Neuer Tag" id="tooltip_${tagCounter}" style="width: 100%;"></td>
                <td style="padding: 5px;"><input type="text" value="N" id="label_${tagCounter}" style="width: 100%;"></td>
                <td style="padding: 5px; text-align: center;"><input type="text" value="" id="shortcut_${tagCounter}" style="width: 100%; text-align: center;" maxlength="1" placeholder="-"></td>
                <td style="padding: 5px; text-align: center;"><input type="checkbox" id="multiple_${tagCounter}"></td>
                <td style="padding: 5px; text-align: center;"><button class="btn btn-delete" data-index="${tagCounter}" style="padding: 2px 8px; background-color: #ffcccc;">🗑️</button></td>
            `;
            table.appendChild(newRow);

            // Event Listener für den neuen Löschen-Button
            newRow.querySelector('.btn-delete').addEventListener('click', function() {
                this.closest('tr').remove();
            });

            // Refresh sortable nach dem Hinzufügen
            $('#tags_table').sortable('refresh');

            tagCounter++;
        });

        // Löschen-Buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('tr').remove();
            });
        });

        document.getElementById('settings_save').addEventListener('click', () => {
            // Sammle alle Zeilen
            const rows = document.querySelectorAll('#tags_table tr[data-index]');
            TAG_BUTTONS = [];

            rows.forEach(row => {
                const index = row.getAttribute('data-index');
                const isSeparator = row.getAttribute('data-separator') === 'true';
                
                if (isSeparator) {
                    TAG_BUTTONS.push({
                        isSeparator: true
                    });
                } else {
                    const tooltipInput = document.getElementById(`tooltip_${index}`);
                    const labelInput = document.getElementById(`label_${index}`);
                    const shortcutInput = document.getElementById(`shortcut_${index}`);
                    const multipleInput = document.getElementById(`multiple_${index}`);

                    if (tooltipInput && labelInput && multipleInput && shortcutInput) {
                        TAG_BUTTONS.push({
                            tooltip: tooltipInput.value,
                            label: labelInput.value,
                            value: labelInput.value,
                            shortcut: shortcutInput.value.trim(),
                            multiple: multipleInput.checked
                        });
                    }
                }
            });

            // Speichere Tag-Position Einstellung
            const selectedPosition = document.querySelector('input[name="tag_position"]:checked').value;
            TAG_BEFORE_NAME = selectedPosition === 'before';

            // Speichere in localStorage
            localStorage.setItem('attack_tagger_buttons', JSON.stringify(TAG_BUTTONS));
            localStorage.setItem('attack_tagger_before', TAG_BEFORE_NAME.toString());

            overlay.remove();
            showNotification('Einstellungen gespeichert! Seite neu laden für Änderungen.');
        });

        // Schließe bei Klick auf Overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

})();
