; "Open in Kite" shell verbs for folders, folder backgrounds, and drives.
; HKCU matches installer currentUser scope. %V = clicked path.
; NoWorkingDirectory keeps Explorer from overriding %V (System32 on Drive).
;
; The NSIS finish page keeps both "Run Kite" and "Create Desktop Shortcut"
; checked by default.

!macro NSIS_HOOK_POSTINSTALL
  ; Belt-and-suspenders: even if the finish-page checkbox is ever re-enabled,
  ; never leave a Run-on-login entry behind (e.g. from an old install).
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Kite"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"

  ; Always clean up any existing context menu entries first, then re-add them.
  ; Registration is unconditional, matching the MSI component in
  ; wix/shell-context-menu.wxs, which has never prompted. Uninstall removes
  ; these keys again.
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInKite"

  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite" "" "Open with Kite"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite" "Icon" "$INSTDIR\kite.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite" "" "Open with Kite"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite" "Icon" "$INSTDIR\kite.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite" "" "Open with Kite"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite" "Icon" "$INSTDIR\kite.exe"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInKite\command" "" '"$INSTDIR\kite.exe" "%1"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInKite"
  Delete "$DESKTOP\Kite.lnk"
  Delete "$SMPROGRAMS\Kite.lnk"
!macroend
