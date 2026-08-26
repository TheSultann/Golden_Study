import type { FinanceOverview, FinanceTransaction, FinanceTransactionType, StaffMember } from '@golden-study/contracts'

export interface SaveFinanceTransactionInput { type: FinanceTransactionType; category: string; amount: number; subject: string; comment: string }
export interface SaveStudentPaymentInput { studentId: string; groupId: string; studentCode: string; studentName: string; group: string; method: string; amount: number; comment: string; paidAt?: string }
export interface SaveExpenseInput { category: string; subject: string; amount: number; comment: string }

export interface FinanceRepository {
  overview(staffMembers?: StaffMember[]): Promise<FinanceOverview>
  saveTransaction(input: SaveFinanceTransactionInput): Promise<FinanceTransaction>
  saveStudentPayment(input: SaveStudentPaymentInput): Promise<FinanceTransaction>
  saveExpense(input: SaveExpenseInput): Promise<FinanceTransaction>
  paySalary(teacherId: string): Promise<void>
}
