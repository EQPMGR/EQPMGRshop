'use server';

import { FieldValue, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { doc, writeBatch, collection, getDoc, deleteDoc } from 'firebase/firestore';
import type { UserComponent, MasterComponent, MaintenanceLog } from '@/lib/types';


// Helper to create a slug from a component's details
const createComponentId = (component: Partial<MasterComponent>) => {
    const idString = [component.brand, component.name, component.model, component.size]
        .filter(Boolean)
        .join('-');
    
    if (!idString) return null;

    return idString
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};


export async function replaceUserComponentAction({
    userId,
    equipmentId,
    userComponentIdToReplace,
    replacementReason,
    newMasterComponentId,
    manualNewComponentData,
    shopId,
    shopName,
}: {
    userId: string;
    equipmentId: string;
    userComponentIdToReplace: string;
    replacementReason: 'failure' | 'modification' | 'upgrade';
    newMasterComponentId?: string | null;
    manualNewComponentData?: {
        name: string;
        brand: string;
        series?: string;
        model?: string;
        size?: string;
    } | null;
    shopId: string;
    shopName: string;
}) {
    if (!userId || !equipmentId || !userComponentIdToReplace) {
        throw new Error("Missing required parameters for component replacement.");
    }
    
    if (!newMasterComponentId && !manualNewComponentData) {
        throw new Error("Either a selected component or manual component data must be provided.");
    }
    
    const batch = writeBatch(db);
    
    try {
        const componentToReplaceRef = doc(db, `users/${userId}/equipment/${equipmentId}/components/${userComponentIdToReplace}`);
        const componentToReplaceSnap = await getDoc(componentToReplaceRef);
        
        if (!componentToReplaceSnap.exists) {
             throw new Error(`Component with ID ${userComponentIdToReplace} not found.`);
        }
        const componentData = componentToReplaceSnap.data() as UserComponent;

        const masterComponentSnap = await getDoc(doc(db, `masterComponents/${componentData.masterComponentId}`));
        if (!masterComponentSnap.exists()) {
            throw new Error(`Master component ${componentData.masterComponentId} not found.`);
        }
        const masterComponentToReplace = { id: masterComponentSnap.id, ...masterComponentSnap.data() } as MasterComponent;
        
        const equipmentDocRef = doc(db, `users/${userId}/equipment/${equipmentId}`);
        const equipmentDocSnap = await getDoc(equipmentDocRef);
        if (!equipmentDocSnap.exists()) {
            throw new Error("Equipment not found in user data.");
        }
        const equipmentData = equipmentDocSnap.data();

        let finalNewMasterComponentId: string;
        let newComponentSize: string | undefined;
        let newComponentDetails: Partial<MasterComponent>;

        if (newMasterComponentId) {
            finalNewMasterComponentId = newMasterComponentId;
            const newMasterCompDoc = await getDoc(doc(db, `masterComponents/${finalNewMasterComponentId}`));
            if (!newMasterCompDoc.exists) {
                throw new Error("Selected replacement component not found in database.");
            }
            const masterData = newMasterCompDoc.data() as MasterComponent
            newComponentSize = masterData.size;
            newComponentDetails = {
                name: masterData.name,
                brand: masterData.brand,
                model: masterData.model,
                series: masterData.series,
                size: masterData.size,
                system: masterData.system,
            };
        } else if (manualNewComponentData) {
            newComponentDetails = {
                name: masterComponentToReplace.name, // Inherit name from the part being replaced
                brand: manualNewComponentData.brand,
                series: manualNewComponentData.series,
                model: manualNewComponentData.model,
                size: manualNewComponentData.size,
                system: masterComponentToReplace.system,
            };
            const generatedId = createComponentId(newComponentDetails);
            if (!generatedId) {
                throw new Error("Could not generate a valid ID for the new manual component.");
            }
            finalNewMasterComponentId = generatedId;
            newComponentSize = manualNewComponentData.size;
            
            const cleanNewComponentDetails = Object.fromEntries(
                Object.entries(newComponentDetails).filter(([, v]) => v != null)
            );

            const newMasterComponentRef = doc(db, `masterComponents/${finalNewMasterComponentId}`);
            batch.set(newMasterComponentRef, cleanNewComponentDetails, { merge: true });
        } else {
            throw new Error("No new component data provided.");
        }

        const newLogEntry: MaintenanceLog = {
            id: doc(collection(db, 'tmp')).id,
            date: new Date(),
            componentName: masterComponentToReplace.name,
            serviceType: 'replaced',
            notes: `Replaced ${masterComponentToReplace.name} (${masterComponentToReplace.brand}) with ${newComponentDetails.brand} ${newComponentDetails.model || ''}. Reason: ${replacementReason}.`,
            shopId: shopId,
            shopName: shopName,
        };

        batch.update(equipmentDocRef, {
            maintenanceLog: FieldValue.arrayUnion({
                ...newLogEntry,
                date: Timestamp.fromDate(newLogEntry.date),
            })
        });

        const newUserComponentData: Partial<UserComponent> = {
            masterComponentId: finalNewMasterComponentId,
            wearPercentage: 0,
            purchaseDate: new Date(),
            lastServiceDate: null,
            notes: `Replaced by ${shopName} on ${new Date().toLocaleDateString()}`,
            size: newComponentSize || undefined,
        };
        
        const cleanData = Object.fromEntries(Object.entries(newUserComponentData).filter(([, v]) => v !== undefined));
        batch.set(componentToReplaceRef, cleanData);
        
        await batch.commit();
        
        return { success: true, message: "Component replaced successfully." };

    } catch (error) {
        console.error("[SERVER ACTION ERROR] in replaceUserComponentAction:", error);
        if ((error as any).code === 'permission-denied' || (error as any).code === 7) {
            throw new Error('A permission error occurred. This may be due to Firestore security rules.');
        }
        throw new Error((error as Error).message || 'An unexpected error occurred.');
    }
}


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
