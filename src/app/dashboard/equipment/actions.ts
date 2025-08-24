
'use server';

import { FieldValue, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { doc, writeBatch, collection, getDoc, deleteDoc } from 'firebase/firestore';
import type { UserComponent, MasterComponent, MaintenanceLog } from '@/lib/types';


// This file is adapted from the athlete app but is not currently used
// in the shop app's UI. It's kept for potential future use and to maintain
// structural consistency.

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
        throw new Error("Missing required parameters for component deletion.");
    }

    try {
        const componentRef = doc(db, `users/${userId}/equipment/${equipmentId}/components/${userComponentId}`);
        await deleteDoc(componentRef);
        return { success: true, message: "Component deleted successfully." };

    } catch(error) {
        console.error("[SERVER ACTION ERROR] in deleteUserComponentAction:", error);
        if ((error as any).code === 'permission-denied' || (error as any).code === 7) {
            throw new Error('A permission error occurred. This may be due to Firestore security rules.');
        }
        throw new Error((error as Error).message || 'An unexpected error occurred.');
    }
}
