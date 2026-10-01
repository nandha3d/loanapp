/** Fields an agent may request changes to on a customer record (customer_edit). */
export const CUSTOMER_EDIT_ALLOW_LIST = new Set([
  'name', 'phone', 'address', 'aadharNumber', 'kycStatus', 'photo', 'profilePhoto', 'photoUrl', 'lat', 'lng',
]);
