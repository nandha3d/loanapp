import { getBorrowerSession } from '@/lib/borrowerAuth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { formatDate, formatCurrency } from '@/lib/utils';

export default async function BorrowerDashboard() {
  const session = await getBorrowerSession();

  if (!session) {
    redirect('/borrower/login');
  }

  const loan = await prisma.loan.findUnique({
    where: { id: session.loanId },
    include: {
      customer: true,
      instalments: {
        orderBy: { instalmentNo: 'asc' },
      },
    },
  });

  if (!loan) {
    redirect('/borrower/login');
  }

  const totalPaid = loan.instalments.reduce((sum, inst) => sum + Number(inst.receivedAmount), 0);
  const totalDue = Number(loan.totalPayable);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0 }}>My Loan</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {loan.customer.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{loan.loanCode}</div>
          <a href="/api/borrower/logout" style={{ fontSize: '.8rem', color: 'var(--danger)' }}>Logout</a>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Total Payable</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(totalDue)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Total Paid</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Balance</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(totalDue - totalPaid)}</div>
        </div>
      </div>

      <div className="card">
        <h3>Repayment History</h3>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loan.instalments.map(inst => (
                <tr key={inst.id}>
                  <td>{inst.instalmentNo}</td>
                  <td>{formatDate(inst.dueDate)}</td>
                  <td>{formatCurrency(Number(inst.dueAmount))}</td>
                  <td>{formatCurrency(Number(inst.receivedAmount))}</td>
                  <td>
                    <span className={`badge badge-${inst.status === 'paid' ? 'success' : inst.status === 'overdue' ? 'danger' : 'warning'}`}>
                      {inst.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
