# kite-shell-integration (zprofile)
#
# See zshenv.zsh for the rationale on the trailing `:`.
{
  _kite_user_zdotdir="${KITE_USER_ZDOTDIR:-$HOME}"
  [ -f "$_kite_user_zdotdir/.zprofile" ] && source "$_kite_user_zdotdir/.zprofile"
  unset _kite_user_zdotdir
}
:
