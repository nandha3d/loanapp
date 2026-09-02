/**
 * Browser helpers for the Auto Finance suite.
 *
 * The page-level primitives are module-agnostic and re-exported from the
 * micro-lending suite; only the module prefix differs.
 */
export {
  waitForHydration,
  login,
  loginExpectingSuccess,
  logout,
  setActiveBranch,
  activeBranchCookie,
  expectRendered,
  gotoOk,
  bodyText,
} from '../../microlending/support/ui';

export const MODULE = 'autofinance';

/** A path inside the auto-finance module, e.g. apath('/vehicles'). */
export function apath(sub: string): string {
  return `/${MODULE}${sub.startsWith('/') ? sub : `/${sub}`}`;
}
