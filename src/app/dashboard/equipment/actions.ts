
'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc } from '@/lib/firestore-compat';

export async function deleteUserComponentAction({
    userId,
    equipmentId,
    userComponentId,
}: {
    userId: string;
    equipmentId: string;
    userComponentId: string;
}) {
    if (!userId || !equipmentId || !userComponentId) {
        throw new Error('Missing required parameters for component deletion.');
    }

    try {
        await deleteDoc(doc(db, 'users', userId, 'equipment', equipmentId, 'components', userComponentId));
        return { success: true, message: 'Component deleted successfully.' };

    } catch(error) {
        console.error('[SERVER ACTION ERROR] in deleteUserComponentAction:', error);
        if ((error as any).code === 'permission-denied' || (error as any).code === 7) {
            throw new Error('A permission error occurred. This may be due to access rules.');
        }
        throw new Error((error as Error).message || 'An unexpected error occurred.');
    }
}
