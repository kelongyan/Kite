; "Open in Kite" shell verbs for folders, folder backgrounds, and drives.
; HKCU matches installer currentUser scope. %V = clicked path.
; NoWorkingDirectory keeps Explorer from overriding %V (System32 on Drive).
;
; Keep the NSIS finish page from auto-running Kite after install. The app is
; still launched normally when the user opens the shortcut or exe themselves.
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite" "" "Open in Kite"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite" "Icon" '"$INSTDIR\kite.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite" "" "Open in Kite"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite" "Icon" '"$INSTDIR\kite.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite" "" "Open in Kite"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite" "Icon" '"$INSTDIR\kite.exe",0'
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%V"'

  Delete "$DESKTOP\Kite.lnk"
  CreateShortCut "$DESKTOP\Kite.lnk" "$INSTDIR\kite.exe" "" "$INSTDIR\kite.exe" 0
  Delete "$SMPROGRAMS\Kite.lnk"
  CreateShortCut "$SMPROGRAMS\Kite.lnk" "$INSTDIR\kite.exe" "" "$INSTDIR\kite.exe" 0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInKite"
!macroend
