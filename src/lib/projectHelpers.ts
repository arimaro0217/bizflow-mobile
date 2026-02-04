import type { Project, Transaction } from '../types';
import { Timestamp } from 'firebase/firestore';

/**
 * プロジェクトを仮想的なトランザクションに変換する
 * まだ確定した取引がない案件を、カレンダー上で「見込み」として表示するために使用
 */
export function convertProjectToTransaction(project: Project): Transaction {
    return {
        id: `project-virtual-${project.id}`,
        uid: project.uid,
        type: 'income', // 案件は基本的に収入
        amount: project.estimatedAmount || '0',
        taxRate: '0.1', // デフォルト
        // 発生日 = 案件の終了日とする（売上計上基準）
        transactionDate: project.endDate || project.startDate || new Date(),
        // 決済日 = まだ未定（null）または支払条件から計算も可能だが、一旦null
        settlementDate: null,
        isSettled: false,
        clientId: project.clientId,
        memo: project.title, // メモに案件名を入れる
        createdAt: project.createdAt || new Date(),
        updatedAt: project.updatedAt || new Date(),
        projectId: project.id,
        isEstimate: true, // 見込みフラグ
    };
}
