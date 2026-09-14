import { Injectable, signal, computed } from '@angular/core';
import { Sex, RelationshipType, TimelineEventType } from '../api/api-client.service';

type Lang = 'en' | 'de';

const T: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    'nav.settings': 'Settings', 'nav.users': 'User Management', 'nav.logout': 'Sign out',
    'nav.theme.dark': 'Light mode', 'nav.theme.light': 'Dark mode',
    'nav.lang': 'Sprache / Language',

    // Common
    'save': 'Save', 'cancel': 'Cancel', 'delete': 'Delete', 'back': 'Back',
    'saving': 'Saving…', 'loading': 'Loading…', 'add': 'Add', 'remove': 'Remove',
    'optional': 'optional', 'edit': 'Edit', 'search': 'Search', 'retry': 'Try again',
    'err.save': 'Save failed.', 'err.delete': 'Delete failed.', 'err.load': 'Failed to load.',

    // Sex
    'sex.male': 'Male', 'sex.female': 'Female',
    'sex.label': 'Sex',

    // Event types
    'event.birth': 'Birth', 'event.death': 'Death', 'event.marriage': 'Marriage',
    'event.move': 'Move', 'event.occupation': 'Occupation',
    'event.education': 'Education', 'event.custom': 'Event',

    // Relationship types
    'rel.parent': 'Parent', 'rel.child': 'Child', 'rel.spouse': 'Spouse', 'rel.adoptive': 'Adoptive',

    // Person edit
    'pe.new': 'Add person', 'pe.edit': 'Edit person',
    'pe.basics': 'Basic info', 'pe.birth': 'Birth', 'pe.death': 'Death',
    'pe.notes': 'Notes', 'pe.firstName': 'First name', 'pe.lastName': 'Last name',
    'pe.maidenName': 'Maiden name', 'pe.birthYear': 'Year', 'pe.birthMonth': 'Month',
    'pe.birthDay': 'Day', 'pe.birthPlace': 'Birthplace', 'pe.deathPlace': 'Place of death',
    'pe.causeOfDeath': 'Cause of death',
    'pe.approx': 'Approximate date', 'pe.save': 'Add person', 'pe.update': 'Save changes',
    'pe.required': 'First and last name are required.',
    'pe.avatar': 'Profile photo', 'pe.avatarHint': 'Click to upload',
    'pe.avatarPending': 'Photo will be uploaded on save.',
    'pe.deleteConfirm': 'Permanently delete __NAME__ and all associated data?',
    'pe.optional': 'optional',

    // Person detail
    'pd.back': '← Tree', 'pd.lifespan.b': 'b.', 'pd.lifespan.d': 'd.',
    'pd.birth': 'Birth', 'pd.death': 'Death', 'pd.causeOfDeath': 'Cause of death', 'pd.notes': 'Notes',

    // Timeline
    'tl.title': 'Timeline', 'tl.addEvent': '+ Event', 'tl.cancel': '✕ Cancel',
    'tl.type': 'Type', 'tl.eventTitle': 'Title', 'tl.year': 'Year',
    'tl.month': 'Month', 'tl.day': 'Day', 'tl.place': 'Place', 'tl.desc': 'Description',
    'tl.add': 'Add', 'tl.save': 'Save', 'tl.noEvents': 'No events recorded yet.',
    'tl.unknownDate': 'Unknown date', 'tl.era': 's',
    'tl.marriage.hint': '💡 Wedding events are also created automatically — add a spouse under Family.',
    'tl.marriage.spouse': 'Spouse', 'tl.marriage.spousePlaceholder': 'Search person…',
    'tl.endYear': 'End year', 'tl.endMonth': 'End month', 'tl.endDay': 'End day',
    'tl.until': 'until', 'tl.auto': 'auto', 'tl.deleteConfirm': 'Delete this event?',

    // Relations
    'fam.title': 'Family', 'fam.add': '+ Add', 'fam.cancel': '✕',
    'fam.type': 'Relationship type', 'fam.search': 'Search person',
    'fam.placeholder': 'Enter name…', 'fam.date': 'Date', 'fam.year': 'Year', 'fam.month': 'Month',
    'fam.day': 'Day', 'fam.place': 'Place', 'fam.placePlaceholder': 'Wedding location…',
    'fam.addBtn': 'Add relationship', 'fam.noRels': 'No family relationships recorded.',
    'fam.parents': 'Parents', 'fam.children': 'Children',
    'fam.spouses': 'Spouses', 'fam.adoptive': 'Adoptive',
    'fam.spouse.hint': '💡 A wedding event is created automatically.',
    'fam.parent.hint': '💡 Select the parent of this person.',
    'fam.child.hint':  '💡 Select the child of this person.',
    'fam.adoptive.hint': '💡 Select the adoptive parent of this person.',
    'fam.removeConfirm': 'Remove relationship with __NAME__?',

    // Media
    'media.title': 'Photos & Documents', 'media.add': '+ Add',
    'media.uploading': 'Uploading…', 'media.empty': 'No files uploaded yet.',
    'media.deleteConfirm': 'Delete file?', 'media.setAvatar': 'Set as profile photo',
    'media.avatarBadge': 'Avatar',

    // Tree view
    'tree.back': '← Trees', 'tree.search': '🔍 Search', 'tree.import': '↑ Import',
    'tree.addPerson': '+ Person', 'tree.filter': 'Filter people…', 'tree.noResults': 'No results.',
    'tree.addRel': 'Add Relationship', 'tree.relType': 'Type',
    'tree.relFrom': 'From', 'tree.relTo': 'To', 'tree.relAdd': 'Add',
    'tree.relFromPlaceholder': 'Search person…', 'tree.relToPlaceholder': 'Search person…',
    'tree.relErr': 'Failed to add relationship',
    'tree.layoutTree': 'Tree', 'tree.layoutAuto': 'Auto',
    'tree.layoutToggle': 'Switch layout', 'tree.resetLayout': 'Reset layout',
    'tree.fit': 'Fit to screen', 'tree.zoomIn': 'Zoom in', 'tree.zoomOut': 'Zoom out',
    'tree.export': 'Download as PNG',
    'tree.graphLabel': 'Family tree graph. Use the people list to navigate. Press + / − to zoom, 0 to fit, Escape to deselect.',
    'tree.peopleList': 'People in this tree',
    'tree.emptyTitle': 'This tree has no people yet.',
    'tree.openProfile': 'Open profile', 'tree.clearSelection': 'Clear',

    // Login / Register
    'login.tagline': 'Your family history, beautifully preserved',
    'login.username': 'Username', 'login.password': 'Password',
    'login.submit': 'Sign in', 'login.submitting': 'Signing in…',
    'login.error': 'Sign-in failed', 'login.noAccount': 'No account?',
    'login.register': 'Register now',
    'login.demo': 'Demo account', 'login.demoUser': 'Username', 'login.demoPass': 'Password',
    'register.title': 'Create account', 'register.tagline': 'Start your family tree today',
    'register.username': 'Username', 'register.displayName': 'Display name',
    'register.email': 'E-mail', 'register.password': 'Password',
    'register.passwordHint': 'min. 8 characters',
    'register.submit': 'Create account', 'register.submitting': 'Creating account…',
    'register.error': 'Registration failed', 'register.haveAccount': 'Already registered?',
    'register.login': 'Sign in',
    'register.pendingTitle': 'Account created ✓',
    'register.pendingHint': 'An administrator needs to activate your account before you can sign in.',

    // Settings
    'settings.title': 'Settings', 'settings.loading': 'Loading profile…',
    'settings.password.title': 'Change password',
    'settings.password.current': 'Current password', 'settings.password.new': 'New password (min. 8 chars)',
    'settings.password.save': 'Save password', 'settings.password.saving': 'Saving…',
    'settings.password.ok': 'Password changed. Other devices have been signed out.',
    'settings.lang.title': 'Language', 'settings.lang.hint': 'Choose your preferred display language.',
    'settings.lang.saved': 'Language saved.',
    'settings.export.title': 'Export data',
    'settings.export.hint': 'Download all your trees, persons and events as a JSON file.',
    'settings.export.btn': 'Download data', 'settings.export.busy': 'Exporting…',
    'settings.deleteData.title': 'Delete all data',
    'settings.deleteData.hint': 'Permanently deletes all your trees, persons and events — your account remains.',
    'settings.deleteData.btn': 'Delete all data…', 'settings.deleteData.confirm': 'Confirm with password',
    'settings.deleteData.submit': 'Delete data permanently', 'settings.deleteData.deleting': 'Deleting…',
    'settings.delete.title': 'Delete account',
    'settings.delete.hint': 'Permanently deletes your account and all associated data.',
    'settings.delete.btn': 'Delete account…', 'settings.delete.confirm': 'Confirm with password',
    'settings.delete.submit': 'Delete permanently', 'settings.delete.deleting': 'Deleting…',

    // Admin
    'admin.title': 'User Management', 'admin.registered': '__N__ users registered',
    'admin.registration': 'Registration', 'admin.reg.on': 'enabled', 'admin.reg.off': 'disabled',
    'admin.create.btn': '+ Create user', 'admin.create.cancel': 'Cancel',
    'admin.create.title': 'Create new user', 'admin.create.username': 'Username *',
    'admin.create.displayName': 'Display name', 'admin.create.email': 'E-mail',
    'admin.create.password': 'Password *', 'admin.create.isAdmin': 'Grant admin rights',
    'admin.create.submit': 'Create user', 'admin.create.submitting': 'Creating…',
    'admin.pw.title': 'Change password for @__NAME__',
    'admin.pw.placeholder': 'New password (min. 8 chars)',
    'admin.pw.save': 'Save', 'admin.pw.saving': 'Saving…', 'admin.pw.cancel': 'Cancel',
    'admin.table.user': 'User', 'admin.table.email': 'E-mail', 'admin.table.lang': 'Language',
    'admin.table.registered': 'Registered', 'admin.table.status': 'Status',
    'admin.table.role': 'Role', 'admin.table.actions': 'Actions',
    'admin.status.active': 'Active', 'admin.status.inactive': 'Inactive',
    'admin.role.admin': 'Admin', 'admin.role.user': 'User',
    'admin.action.deactivate': 'Deactivate', 'admin.action.activate': 'Activate',
    'admin.action.makeAdmin': 'Make admin', 'admin.action.removeAdmin': 'Remove admin',
    'admin.action.password': 'Password', 'admin.action.delete': 'Delete',
    'admin.confirm.makeAdmin': 'Make @__NAME__ an admin?',
    'admin.confirm.removeAdmin': 'Remove admin rights from @__NAME__?',
    'admin.confirm.delete': 'Delete @__NAME__ and all their data permanently?',
    'admin.me': 'You', 'admin.loading': 'Loading users…', 'admin.err.load': 'Failed to load users.',

    // Tree list
    'trees.title': 'My Trees', 'trees.new': '+ New Tree', 'trees.cancel': '✕ Cancel',
    'trees.new.title': 'New family tree', 'trees.new.name': 'Name',
    'trees.new.desc': 'Description', 'trees.new.submit': 'Create Tree',
    'trees.empty': 'No trees yet. Create your first family tree above.',
    'trees.open': 'Open', 'trees.edit': '✏️ Edit', 'trees.delete': 'Delete',
    'trees.created': 'Created', 'trees.save': 'Save', 'trees.editCancel': 'Cancel',
    'trees.persons': 'people',
    'trees.delete.confirm': 'Delete this tree and all its data permanently?',
    'trees.err.load': 'Failed to load trees.', 'trees.err.create': 'Failed to create tree.',
    'trees.err.save': 'Failed to save changes.', 'trees.err.delete': 'Failed to delete tree.',
    'trees.optional': 'optional',

    // Search
    'search.title': 'Search', 'search.back': '← Tree',
    'search.placeholder': 'Search by name…', 'search.searching': 'Searching…',
    'search.noResults': 'No results for "__Q__".',
    'search.noDates': 'No dates recorded',

    // Date picker
    'date.pick': 'Open date picker', 'date.clear': 'Clear', 'date.hint': 'DD.MM.YYYY',
    'date.unknown': 'unknown',

    // Import
    'import.title': 'Import Genealogy Text', 'import.back': '← Tree',
    'import.guide': 'Format guide',
    'import.paste': 'Paste genealogy text',
    'import.preview': '🔍 Preview', 'import.analyzing': 'Analyzing…',
    'import.commit': '✓ Commit import', 'import.importing': 'Importing…',
    'import.persons': 'persons', 'import.rels': 'relationships',
    'import.previewTitle': 'Preview', 'import.doneTitle': 'Import complete',
    'import.done': '✓ All data has been saved.', 'import.err': 'Import failed.',
  },
  de: {
    // Nav
    'nav.settings': 'Einstellungen', 'nav.users': 'Benutzerverwaltung', 'nav.logout': 'Abmelden',
    'nav.theme.dark': 'Helles Design', 'nav.theme.light': 'Dunkles Design',
    'nav.lang': 'Sprache / Language',

    // Common
    'save': 'Speichern', 'cancel': 'Abbrechen', 'delete': 'Löschen', 'back': 'Zurück',
    'saving': 'Wird gespeichert…', 'loading': 'Lädt…', 'add': 'Hinzufügen', 'remove': 'Entfernen',
    'optional': 'optional', 'edit': 'Bearbeiten', 'search': 'Suchen', 'retry': 'Erneut versuchen',
    'err.save': 'Speichern fehlgeschlagen.', 'err.delete': 'Löschen fehlgeschlagen.', 'err.load': 'Laden fehlgeschlagen.',

    // Sex
    'sex.male': 'Männlich', 'sex.female': 'Weiblich',
    'sex.label': 'Geschlecht',

    // Event types
    'event.birth': 'Geburt', 'event.death': 'Ableben', 'event.marriage': 'Hochzeit',
    'event.move': 'Umzug', 'event.occupation': 'Beruf',
    'event.education': 'Bildung', 'event.custom': 'Ereignis',

    // Relationship types
    'rel.parent': 'Elternteil', 'rel.child': 'Kind', 'rel.spouse': 'Ehegatte/in', 'rel.adoptive': 'Adoptiv',

    // Person edit
    'pe.new': 'Person anlegen', 'pe.edit': 'Person bearbeiten',
    'pe.basics': 'Grunddaten', 'pe.birth': 'Geburt', 'pe.death': 'Tod',
    'pe.notes': 'Notizen', 'pe.firstName': 'Vorname', 'pe.lastName': 'Nachname',
    'pe.maidenName': 'Geburtsname', 'pe.birthYear': 'Jahr', 'pe.birthMonth': 'Monat',
    'pe.birthDay': 'Tag', 'pe.birthPlace': 'Geburtsort', 'pe.deathPlace': 'Sterbeort',
    'pe.causeOfDeath': 'Todesursache',
    'pe.approx': 'Ungefähres Datum', 'pe.save': 'Person anlegen', 'pe.update': 'Änderungen speichern',
    'pe.required': 'Vor- und Nachname sind Pflichtfelder.',
    'pe.avatar': 'Profilfoto', 'pe.avatarHint': 'Klicken zum Hochladen',
    'pe.avatarPending': 'Foto wird beim Speichern hochgeladen.',
    'pe.deleteConfirm': '__NAME__ und alle zugehörigen Daten unwiderruflich löschen?',
    'pe.optional': 'optional',

    // Person detail
    'pd.back': '← Stammbaum', 'pd.lifespan.b': '* ', 'pd.lifespan.d': '† ',
    'pd.birth': 'Geburt', 'pd.death': 'Tod', 'pd.causeOfDeath': 'Todesursache', 'pd.notes': 'Notizen',

    // Timeline
    'tl.title': 'Zeitleiste', 'tl.addEvent': '+ Ereignis', 'tl.cancel': '✕ Abbrechen',
    'tl.type': 'Typ', 'tl.eventTitle': 'Titel', 'tl.year': 'Jahr',
    'tl.month': 'Monat', 'tl.day': 'Tag', 'tl.place': 'Ort', 'tl.desc': 'Beschreibung',
    'tl.add': 'Hinzufügen', 'tl.save': 'Speichern', 'tl.noEvents': 'Noch keine Ereignisse erfasst.',
    'tl.unknownDate': 'Datum unbekannt', 'tl.era': 'er Jahre',
    'tl.marriage.hint': '💡 Hochzeiten können auch automatisch erstellt werden — füge unter Familie einen Ehepartner hinzu.',
    'tl.marriage.spouse': 'Ehepartner/in', 'tl.marriage.spousePlaceholder': 'Person suchen…',
    'tl.endYear': 'Ende Jahr', 'tl.endMonth': 'Ende Monat', 'tl.endDay': 'Ende Tag',
    'tl.until': 'bis', 'tl.auto': 'auto', 'tl.deleteConfirm': 'Dieses Ereignis löschen?',

    // Relations
    'fam.title': 'Familie', 'fam.add': '+ Hinzufügen', 'fam.cancel': '✕',
    'fam.type': 'Beziehungstyp', 'fam.search': 'Person suchen',
    'fam.placeholder': 'Name eingeben…', 'fam.date': 'Datum', 'fam.year': 'Jahr', 'fam.month': 'Monat',
    'fam.day': 'Tag', 'fam.place': 'Ort', 'fam.placePlaceholder': 'Hochzeitsort…',
    'fam.addBtn': 'Beziehung hinzufügen', 'fam.noRels': 'Noch keine Familienbeziehungen erfasst.',
    'fam.parents': 'Eltern', 'fam.children': 'Kinder',
    'fam.spouses': 'Ehepartner', 'fam.adoptive': 'Adoptiv',
    'fam.spouse.hint': '💡 Hochzeits-Ereignis wird automatisch erstellt.',
    'fam.parent.hint': '💡 Wähle den Elternteil dieser Person.',
    'fam.child.hint':  '💡 Wähle das Kind dieser Person.',
    'fam.adoptive.hint': '💡 Wähle den Adoptivelternteil dieser Person.',
    'fam.removeConfirm': 'Beziehung mit __NAME__ entfernen?',

    // Media
    'media.title': 'Fotos & Dokumente', 'media.add': '+ Hinzufügen',
    'media.uploading': 'Lädt…', 'media.empty': 'Noch keine Dateien hochgeladen.',
    'media.deleteConfirm': 'Datei löschen?', 'media.setAvatar': 'Als Profilfoto setzen',
    'media.avatarBadge': 'Profilfoto',

    // Tree view
    'tree.back': '← Stammbäume', 'tree.search': '🔍 Suchen', 'tree.import': '↑ Import',
    'tree.addPerson': '+ Person', 'tree.filter': 'Person suchen…', 'tree.noResults': 'Keine Ergebnisse.',
    'tree.addRel': 'Beziehung hinzufügen', 'tree.relType': 'Typ',
    'tree.relFrom': 'Von', 'tree.relTo': 'Zu', 'tree.relAdd': 'Hinzufügen',
    'tree.relFromPlaceholder': 'Person suchen…', 'tree.relToPlaceholder': 'Person suchen…',
    'tree.relErr': 'Fehler beim Hinzufügen',
    'tree.layoutTree': 'Baum', 'tree.layoutAuto': 'Auto',
    'tree.layoutToggle': 'Layout wechseln', 'tree.resetLayout': 'Layout zurücksetzen',
    'tree.fit': 'Einpassen', 'tree.zoomIn': 'Vergrößern', 'tree.zoomOut': 'Verkleinern',
    'tree.export': 'Als PNG herunterladen',
    'tree.graphLabel': 'Stammbaum-Grafik. Nutze die Personenliste zur Navigation. + / − zum Zoomen, 0 zum Einpassen, Escape zum Abwählen.',
    'tree.peopleList': 'Personen in diesem Stammbaum',
    'tree.emptyTitle': 'Dieser Stammbaum enthält noch keine Personen.',
    'tree.openProfile': 'Profil öffnen', 'tree.clearSelection': 'Auswahl aufheben',

    // Login / Register
    'login.tagline': 'Deine Familiengeschichte, wunderschön bewahrt',
    'login.username': 'Benutzername', 'login.password': 'Passwort',
    'login.submit': 'Anmelden', 'login.submitting': 'Anmelden…',
    'login.error': 'Anmeldung fehlgeschlagen', 'login.noAccount': 'Noch kein Konto?',
    'login.register': 'Jetzt registrieren',
    'login.demo': 'Demo-Konto', 'login.demoUser': 'Benutzername', 'login.demoPass': 'Passwort',
    'register.title': 'Konto erstellen', 'register.tagline': 'Starte deinen Stammbaum noch heute',
    'register.username': 'Benutzername', 'register.displayName': 'Anzeigename',
    'register.email': 'E-Mail', 'register.password': 'Passwort',
    'register.passwordHint': 'mind. 8 Zeichen',
    'register.submit': 'Konto erstellen', 'register.submitting': 'Konto wird erstellt…',
    'register.error': 'Registrierung fehlgeschlagen', 'register.haveAccount': 'Bereits registriert?',
    'register.login': 'Anmelden',
    'register.pendingTitle': 'Konto erstellt ✓',
    'register.pendingHint': 'Ein Administrator muss dein Konto freischalten, bevor du dich anmelden kannst.',

    // Settings
    'settings.title': 'Einstellungen', 'settings.loading': 'Profil wird geladen…',
    'settings.password.title': 'Passwort ändern',
    'settings.password.current': 'Aktuelles Passwort', 'settings.password.new': 'Neues Passwort (mind. 8 Zeichen)',
    'settings.password.save': 'Passwort speichern', 'settings.password.saving': 'Wird gespeichert…',
    'settings.password.ok': 'Passwort geändert. Andere Geräte wurden abgemeldet.',
    'settings.lang.title': 'Sprache', 'settings.lang.hint': 'Wähle deine bevorzugte Anzeigesprache.',
    'settings.lang.saved': 'Sprache gespeichert.',
    'settings.export.title': 'Daten exportieren',
    'settings.export.hint': 'Alle Stammbäume, Personen und Ereignisse als JSON-Datei herunterladen.',
    'settings.export.btn': 'Daten herunterladen', 'settings.export.busy': 'Exportiere…',
    'settings.deleteData.title': 'Alle Daten löschen',
    'settings.deleteData.hint': 'Löscht alle deine Stammbäume, Personen und Ereignisse – dein Konto bleibt erhalten.',
    'settings.deleteData.btn': 'Alle Daten löschen…', 'settings.deleteData.confirm': 'Mit Passwort bestätigen',
    'settings.deleteData.submit': 'Daten endgültig löschen', 'settings.deleteData.deleting': 'Wird gelöscht…',
    'settings.delete.title': 'Konto löschen',
    'settings.delete.hint': 'Löscht dein Konto und alle zugehörigen Daten unwiderruflich.',
    'settings.delete.btn': 'Konto löschen…', 'settings.delete.confirm': 'Mit Passwort bestätigen',
    'settings.delete.submit': 'Endgültig löschen', 'settings.delete.deleting': 'Wird gelöscht…',

    // Admin
    'admin.title': 'Benutzerverwaltung', 'admin.registered': '__N__ Benutzer registriert',
    'admin.registration': 'Registrierung', 'admin.reg.on': 'aktiv', 'admin.reg.off': 'deaktiviert',
    'admin.create.btn': '+ Benutzer erstellen', 'admin.create.cancel': 'Abbrechen',
    'admin.create.title': 'Neuen Benutzer erstellen', 'admin.create.username': 'Benutzername *',
    'admin.create.displayName': 'Anzeigename', 'admin.create.email': 'E-Mail',
    'admin.create.password': 'Passwort *', 'admin.create.isAdmin': 'Admin-Rechte vergeben',
    'admin.create.submit': 'Benutzer erstellen', 'admin.create.submitting': 'Erstelle…',
    'admin.pw.title': 'Passwort ändern für @__NAME__',
    'admin.pw.placeholder': 'Neues Passwort (mind. 8 Zeichen)',
    'admin.pw.save': 'Speichern', 'admin.pw.saving': 'Wird gespeichert…', 'admin.pw.cancel': 'Abbrechen',
    'admin.table.user': 'Benutzer', 'admin.table.email': 'E-Mail', 'admin.table.lang': 'Sprache',
    'admin.table.registered': 'Registriert', 'admin.table.status': 'Status',
    'admin.table.role': 'Rolle', 'admin.table.actions': 'Aktionen',
    'admin.status.active': 'Aktiv', 'admin.status.inactive': 'Inaktiv',
    'admin.role.admin': 'Admin', 'admin.role.user': 'Benutzer',
    'admin.action.deactivate': 'Deaktivieren', 'admin.action.activate': 'Aktivieren',
    'admin.action.makeAdmin': 'Zum Admin machen', 'admin.action.removeAdmin': 'Admin entfernen',
    'admin.action.password': 'Passwort', 'admin.action.delete': 'Löschen',
    'admin.confirm.makeAdmin': '@__NAME__ zum Admin machen?',
    'admin.confirm.removeAdmin': 'Admin-Rechte von @__NAME__ entfernen?',
    'admin.confirm.delete': '@__NAME__ und alle Daten unwiderruflich löschen?',
    'admin.me': 'Du', 'admin.loading': 'Benutzer werden geladen…', 'admin.err.load': 'Laden fehlgeschlagen.',

    // Tree list
    'trees.title': 'Meine Stammbäume', 'trees.new': '+ Neuer Stammbaum', 'trees.cancel': '✕ Abbrechen',
    'trees.new.title': 'Neuer Stammbaum', 'trees.new.name': 'Name',
    'trees.new.desc': 'Beschreibung', 'trees.new.submit': 'Stammbaum erstellen',
    'trees.empty': 'Noch keine Stammbäume. Erstelle oben deinen ersten.',
    'trees.open': 'Öffnen', 'trees.edit': '✏️ Bearbeiten', 'trees.delete': 'Löschen',
    'trees.created': 'Erstellt', 'trees.save': 'Speichern', 'trees.editCancel': 'Abbrechen',
    'trees.persons': 'Personen',
    'trees.delete.confirm': 'Diesen Stammbaum und alle Daten unwiderruflich löschen?',
    'trees.err.load': 'Stammbäume konnten nicht geladen werden.', 'trees.err.create': 'Stammbaum konnte nicht erstellt werden.',
    'trees.err.save': 'Änderungen konnten nicht gespeichert werden.', 'trees.err.delete': 'Stammbaum konnte nicht gelöscht werden.',
    'trees.optional': 'optional',

    // Search
    'search.title': 'Suche', 'search.back': '← Stammbaum',
    'search.placeholder': 'Nach Name suchen…', 'search.searching': 'Suche…',
    'search.noResults': 'Keine Ergebnisse für „__Q__".',
    'search.noDates': 'Keine Daten erfasst',

    // Date picker
    'date.pick': 'Datumsauswahl öffnen', 'date.clear': 'Leeren', 'date.hint': 'TT.MM.JJJJ',
    'date.unknown': 'unbekannt',

    // Import
    'import.title': 'Genealogie-Text importieren', 'import.back': '← Stammbaum',
    'import.guide': 'Formatanleitung',
    'import.paste': 'Genealogie-Text einfügen',
    'import.preview': '🔍 Vorschau', 'import.analyzing': 'Analysiere…',
    'import.commit': '✓ Import bestätigen', 'import.importing': 'Importiere…',
    'import.persons': 'Personen', 'import.rels': 'Beziehungen',
    'import.previewTitle': 'Vorschau', 'import.doneTitle': 'Import abgeschlossen',
    'import.done': '✓ Alle Daten wurden gespeichert.', 'import.err': 'Import fehlgeschlagen.',
  }
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>((localStorage.getItem('lang') as Lang) ?? 'en');
  readonly lang = this._lang.asReadonly();

  readonly sexLabels = computed(() => ({
    Male: this.t('sex.male'), Female: this.t('sex.female'),
  }));

  readonly eventTypeLabels = computed(() => ({
    Birth: this.t('event.birth'), Death: this.t('event.death'), Marriage: this.t('event.marriage'),
    Move: this.t('event.move'), Occupation: this.t('event.occupation'),
    Education: this.t('event.education'), Custom: this.t('event.custom'),
  }));

  readonly relTypeLabels = computed(() => ({
    Parent: this.t('rel.parent'), Spouse: this.t('rel.spouse'), Adoptive: this.t('rel.adoptive'),
  }));

  t(key: string): string {
    return T[this._lang()][key] ?? T['en'][key] ?? key;
  }

  setLang(lang: Lang) {
    this._lang.set(lang);
    localStorage.setItem('lang', lang);
  }

  sexLabel(s: Sex): string { return this.t('sex.' + s.toLowerCase()); }
  eventLabel(type: TimelineEventType): string { return this.t('event.' + type.toLowerCase()); }
  relLabel(type: RelationshipType): string { return this.t('rel.' + type.toLowerCase()); }
}
