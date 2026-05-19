export default async function MockRazorpayCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string }>;
}) {
  const { subscription } = await searchParams;
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: 24 }}>
      <h1>Mock Razorpay Checkout</h1>
      <p>This local-only checkout confirms that subscription initiation can complete without live Razorpay credentials.</p>
      <p><strong>Subscription:</strong> {subscription || 'mock'}</p>
      <a className="btn btn-primary" href="/portal/billing">Return to billing</a>
    </main>
  );
}
