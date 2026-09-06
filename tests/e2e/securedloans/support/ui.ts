/**
 * Browser helpers for the Secured Lending suite.
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

export const MODULE = 'property';

/** A path inside the auto-finance module, e.g. ppath('/vehicles'). */
export function ppath(sub: string): string {
  return `/${MODULE}${sub.startsWith('/') ? sub : `/${sub}`}`;
}
