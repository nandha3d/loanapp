type Numeric = number | string | { toString(): string };

export interface ChitCustomerMembershipInput {
  id: string;
  memberNumber: number;
  ticketNo: string | null;
  subscriberStatus: string;
  hasWon: boolean;
  chitGroup: {
    id: string;
    groupCode: string | null;
    name: string;
    status: string;
  };
  subscriptions: Array<{
    dueAmount: Numeric;
    dividendAmount: Numeric;
    interestAmount: Numeric;
    penaltyAmount: Numeric;
    paidAmount: Numeric;
  }>;
}

function amount(value: Numeric): number {
  return Number(value);
}

export function buildChitCustomerProfile(inputs: ChitCustomerMembershipInput[]) {
  const memberships = inputs.map((membership) => {
    const contributed = membership.subscriptions.reduce(
      (total, subscription) => total + amount(subscription.paidAmount),
      0,
    );
    const outstandingSubscriptionDue = membership.subscriptions.reduce(
      (total, subscription) => total + Math.max(
        0,
        amount(subscription.dueAmount)
          - amount(subscription.dividendAmount)
          + amount(subscription.interestAmount)
          + amount(subscription.penaltyAmount)
          - amount(subscription.paidAmount),
      ),
      0,
    );

    return {
      id: membership.id,
      groupId: membership.chitGroup.id,
      groupCode: membership.chitGroup.groupCode,
      groupName: membership.chitGroup.name,
      groupStatus: membership.chitGroup.status,
      ticket: membership.ticketNo || String(membership.memberNumber),
      subscriberStatus: membership.subscriberStatus,
      contributed,
      outstandingSubscriptionDue,
      hasWon: membership.hasWon,
    };
  });

  return {
    summary: {
      activeChits: inputs.filter(
        (membership) => membership.subscriberStatus === 'active' && membership.chitGroup.status === 'active',
      ).length,
      totalContributed: memberships.reduce((total, membership) => total + membership.contributed, 0),
      outstandingSubscriptionDue: memberships.reduce(
        (total, membership) => total + membership.outstandingSubscriptionDue,
        0,
      ),
      prizedChits: inputs.filter((membership) => membership.hasWon).length,
    },
    memberships,
  };
}

export type ChitCustomerProfile = ReturnType<typeof buildChitCustomerProfile>;
