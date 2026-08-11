
'use server';

import { db } from '@/lib/firebase';

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
        const { error } = await db
            .from('components')
            .delete()
            .eq('id', userComponentId)
            .eq('equipment_id', equipmentId)
            .eq('user_id', userId);

        if (error) throw error;

        return { success: true, message: 'Component deleted successfully.' };

    } catch(error) {
        console.error('[SERVER ACTION ERROR] in deleteUserComponentAction:', error);
        if ((error as any).code === 'PGRST116' || (error as any).code === 'permission-denied') {
            throw new Error('A permission error occurred. This may be due to access rules.');
        }
        throw new Error((error as Error).message || 'An unexpected error occurred.');
    }
}
