'use server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from '@/lib/firestore-compat';
import type { UserComponent, MasterComponent, MaintenanceLog } from '@/lib/types';

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
    throw new Error('Missing required parameters for component replacement.');
  }

  if (!newMasterComponentId && !manualNewComponentData) {
    throw new Error('Either a selected component or manual component data must be provided.');
  }

  try {
    const componentToReplaceRef = doc(db, 'users', userId, 'equipment', equipmentId, 'components', userComponentIdToReplace);
    const componentToReplaceSnap = await getDoc(componentToReplaceRef);

    if (!componentToReplaceSnap.exists) {
      throw new Error(`Component with ID ${userComponentIdToReplace} not found.`);
    }

    const componentData = componentToReplaceSnap.data() as UserComponent;
    const masterComponentRef = doc(db, 'masterComponents', componentData.masterComponentId);
    const masterComponentSnap = await getDoc(masterComponentRef);

    if (!masterComponentSnap.exists) {
      throw new Error(`Master component ${componentData.masterComponentId} not found.`);
    }

    const masterComponentToReplace = { id: masterComponentSnap.id, ...masterComponentSnap.data() } as MasterComponent;
    const equipmentDocRef = doc(db, 'users', userId, 'equipment', equipmentId);
    const equipmentDocSnap = await getDoc(equipmentDocRef);

    if (!equipmentDocSnap.exists) {
      throw new Error('Equipment not found in user data.');
    }

    let finalNewMasterComponentId: string;
    let newComponentSize: string | undefined;
    let newComponentDetails: Partial<MasterComponent>;

    if (newMasterComponentId) {
      finalNewMasterComponentId = newMasterComponentId;
      const newMasterCompDoc = await getDoc(doc(db, 'masterComponents', finalNewMasterComponentId));
      if (!newMasterCompDoc.exists) {
        throw new Error('Selected replacement component not found in database.');
      }
      const masterData = newMasterCompDoc.data() as MasterComponent;
      newComponentSize = masterData.size;
      newComponentDetails = {
        name: masterData.name,
        brand: masterData.brand,
        model: masterData.model,
        series: masterData.series,
        size: masterData.size,
        system: masterData.system,
      };
    } else {
      newComponentDetails = {
        name: masterComponentToReplace.name,
        brand: manualNewComponentData!.brand,
        series: manualNewComponentData!.series,
        model: manualNewComponentData!.model,
        size: manualNewComponentData!.size,
        system: masterComponentToReplace.system,
      };
      const generatedId = createComponentId(newComponentDetails);
      if (!generatedId) {
        throw new Error('Could not generate a valid ID for the new manual component.');
      }
      finalNewMasterComponentId = generatedId;
      newComponentSize = manualNewComponentData?.size;

      const cleanNewComponentDetails = Object.fromEntries(
        Object.entries(newComponentDetails).filter(([, value]) => value != null && value !== '')
      );

      await setDoc(doc(db, 'masterComponents', finalNewMasterComponentId), cleanNewComponentDetails, { merge: true });
    }

    const existingLog = Array.isArray(equipmentDocSnap.data().maintenanceLog)
      ? equipmentDocSnap.data().maintenanceLog
      : [];

    const newLogEntry: MaintenanceLog = {
      id: crypto.randomUUID(),
      date: new Date(),
      componentName: masterComponentToReplace.name,
      serviceType: 'replaced',
      notes: `Replaced ${masterComponentToReplace.brand || ''} ${masterComponentToReplace.model || ''} with ${newComponentDetails.brand || ''} ${newComponentDetails.model || ''}. Reason: ${replacementReason}.`,
      shopId,
      shopName,
    };

    await updateDoc(equipmentDocRef, {
      maintenanceLog: [...existingLog, newLogEntry],
    });

    const cleanData: Record<string, any> = {
      masterComponentId: finalNewMasterComponentId,
      wearPercentage: 0,
      totalDistance: 0,
      totalHours: 0,
      purchaseDate: new Date(),
      notes: `Replaced by ${shopName} on ${new Date().toLocaleDateString()}`,
      size: newComponentSize,
      parentUserComponentId: componentData.parentUserComponentId,
    };

    await setDoc(componentToReplaceRef, cleanData, { merge: true });

    return { success: true, message: 'Component replaced successfully.' };
  } catch (error) {
    console.error('[SERVER ACTION ERROR] in replaceUserComponentAction:', error);
    if ((error as any).code === 'permission-denied' || (error as any).code === 7) {
      throw new Error('A permission error occurred. This may be due to access rules.');
    }
    throw new Error((error as Error).message || 'An unexpected error occurred during component replacement.');
  }
}
