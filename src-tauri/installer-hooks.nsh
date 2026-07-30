; Keep the NSIS finish page from auto-running Kite after install.
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

!macro NSIS_HOOK_POSTINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInKite"
  Delete "$DESKTOP\Kite.lnk"
  Delete "$SMPROGRAMS\Kite.lnk"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInKite"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInKite"
  Delete "$DESKTOP\Kite.lnk"
  Delete "$SMPROGRAMS\Kite.lnk"
!macroend
