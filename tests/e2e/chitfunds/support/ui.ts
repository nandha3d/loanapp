/**
 * Browser helpers for the chit suite.
 *
 * The page-level primitives (hydration wait, login, branch cookie, blank-page
 * guard) are module-agnostic and are re-exported from the micro-lending suite.
 * Only the module prefix differs, so only that is defined here.
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

export const MODULE = 'chitfunds';

/** A path inside the chit module, e.g. cpath('/chits') → /chitfunds/chits. */
export function cpath(sub: string): string {
  return `/${MODULE}${sub.startsWith('/') ? sub : `/${sub}`}`;
}

/** The auction detail screen for a group/auction pair. */
export function auctionPath(groupId: string, auctionId: string): string {
  return cpath(`/chits/${groupId}/auctions/${auctionId}`);
}
