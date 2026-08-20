; Tauri's generated installer.nsi unconditionally defines MUI_FINISHPAGE_RUN
; (see below), so the finish page always shows a "Run Kite" checkbox. This file
; is included BEFORE those defines, so we can make that checkbox unchecked by
; default — the user has to opt in to launch Kite after install.
;
;   installer.nsi (generated):
;     !include installer-hooks.nsh     <- this file
;     ...
;     !define MUI_FINISHPAGE_RUN
;     !define MUI_FINISHPAGE_RUN_FUNCTION RunMainBinary
;
; Define BOTH the NOTCHECKED variant (checkbox off by default) and a benign RUN
; text (shown alongside the checkbox). MUI_FINISHPAGE_RUN_CHECKED would override
; NOTCHECKED — never define it here.
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_RUN_TEXT "$(^Name) will start after installation."
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

!macro NSIS_HOOK_POSTINSTALL
  ; Belt-and-suspenders: even if the finish-page checkbox is ever re-enabled,
  ; never leave a Run-on-login entry behind (e.g. from an old install).
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Kite"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"

  ; Always clean up any existing context menu entries first
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInKite"

  ; Ask user if they want to add context menu integration (default: No)
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to add 'Open with Kite' to the right-click context menu?$\n$\n(You can always add or remove this later from Kite settings)" /SD IDNO IDYES InstallContextMenu IDNO SkipContextMenu

  InstallContextMenu:
    WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite" "" "Open with Kite"
    WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite" "Icon" "$INSTDIR\kite.exe"
    WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%1"'

    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite" "" "Open with Kite"
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite" "Icon" "$INSTDIR\kite.exe"
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%V"'

    WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite" "" "Open with Kite"
    WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite" "Icon" "$INSTDIR\kite.exe"
    WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%1"'

  SkipContextMenu:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInKite"
  Delete "$DESKTOP\Kite.lnk"
  Delete "$SMPROGRAMS\Kite.lnk"
!macroend
