'use server';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
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
    
    const adminDb = await getAdminDb();
    const batch = adminDb.batch();
    
    try {
        const componentToReplaceRef = adminDb.doc(`users/${userId}/equipment/${equipmentId}/components/${userComponentIdToReplace}`);
        const componentToReplaceSnap = await componentToReplaceRef.get();
        
        if (!componentToReplaceSnap.exists) {
             throw new Error(`Component with ID ${userComponentIdToReplace} not found.`);
        }
        const componentData = componentToReplaceSnap.data() as UserComponent;

        const masterComponentSnap = await adminDb.doc(`masterComponents/${componentData.masterComponentId}`).get();
        if (!masterComponentSnap.exists) {
            throw new Error(`Master component ${componentData.masterComponentId} not found.`);
        }
        const masterComponentToReplace = { id: masterComponentSnap.id, ...masterComponentSnap.data() } as MasterComponent;
        
        const equipmentDocRef = adminDb.doc(`users/${userId}/equipment/${equipmentId}`);
        
        let finalNewMasterComponentId: string;
        let newComponentSize: string | undefined;
        let newComponentDetails: Partial<MasterComponent>;

        if (newMasterComponentId) {
            finalNewMasterComponentId = newMasterComponentId;
            const newMasterCompDoc = await adminDb.doc(`masterComponents/${finalNewMasterComponentId}`).get();
            if (!newMasterCompDoc.exists()) {
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
                Object.entries(newComponentDetails).filter(([, v]) => v != null && v !== '')
            );

            const newMasterComponentRef = adminDb.doc(`masterComponents/${finalNewMasterComponentId}`);
            batch.set(newMasterComponentRef, cleanNewComponentDetails, { merge: true });
        } else {
            throw new Error("No new component data provided.");
        }

        const newLogEntry: MaintenanceLog = {
            id: adminDb.collection('tmp').doc().id,
            date: new Date(),
            componentName: masterComponentToReplace.name,
            serviceType: 'replaced',
            notes: `Replaced ${masterComponentToReplace.brand || ''} ${masterComponentToReplace.model || ''} with ${newComponentDetails.brand || ''} ${newComponentDetails.model || ''}. Reason: ${replacementReason}.`,
            shopId: shopId,
            shopName: shopName,
        };
        
        batch.update(equipmentDocRef, {
            maintenanceLog: FieldValue.arrayUnion({
                ...newLogEntry,
                date: Timestamp.fromDate(newLogEntry.date),
            })
        });

        const newUserComponentData: Omit<UserComponent, 'id'> = {
            masterComponentId: finalNewMasterComponentId,
            wearPercentage: 0,
            totalDistance: 0,
            totalHours: 0,
            purchaseDate: new Date(),
            lastServiceDate: null,
            notes: `Replaced by ${shopName} on ${new Date().toLocaleDateString()}`,
            size: newComponentSize,
            parentUserComponentId: componentData.parentUserComponentId,
        };
        
        // Critically, remove any undefined or null properties before sending to Firestore.
        const cleanData = Object.fromEntries(Object.entries(newUserComponentData).filter(([, value]) => {
            return value !== undefined && value !== null;
        }));

        batch.set(componentToReplaceRef, cleanData);
        
        await batch.commit();
        
        return { success: true, message: "Component replaced successfully." };

    } catch (error) {
        console.error("[SERVER ACTION ERROR] in replaceUserComponentAction:", error);
        // We don't check for permission-denied here because Admin SDK bypasses rules.
        // Any error here is a true server-side crash or data issue.
        throw new Error((error as Error).message || 'An unexpected error occurred during component replacement.');
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
        const adminDb = await getAdminDb();
        const componentRef = adminDb.doc(`users/${userId}/equipment/${equipmentId}/components/${userComponentId}`);
        await componentRef.delete();
        return { success: true, message: "Component deleted successfully." };

    } catch(error) {
        console.error("[SERVER ACTION ERROR] in deleteUserComponentAction:", error);
        throw new Error((error as Error).message || 'An unexpected error occurred.');
    }
}
