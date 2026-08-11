'use server';
import { db } from '@/lib/firebase';
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
    // Get the component to replace
    const { data: componentToReplace, error: componentError } = await db
      .from('components')
      .select('*')
      .eq('id', userComponentIdToReplace)
      .eq('equipment_id', equipmentId)
      .eq('user_id', userId)
      .single();

    if (componentError || !componentToReplace) {
      throw new Error(`Component with ID ${userComponentIdToReplace} not found.`);
    }

    // Get the master component we're replacing
    const { data: masterComponentToReplace, error: masterError } = await db
      .from('master_components')
      .select('*')
      .eq('id', componentToReplace.master_component_id)
      .single();

    if (masterError || !masterComponentToReplace) {
      throw new Error(`Master component ${componentToReplace.master_component_id} not found.`);
    }

    // Get the equipment
    const { data: equipment, error: equipmentError } = await db
      .from('equipment')
      .select('*')
      .eq('id', equipmentId)
      .eq('user_id', userId)
      .single();

    if (equipmentError || !equipment) {
      throw new Error('Equipment not found in user data.');
    }

    let finalNewMasterComponentId: string;
    let newComponentSize: string | undefined;
    let newComponentDetails: Partial<MasterComponent>;

    if (newMasterComponentId) {
      finalNewMasterComponentId = newMasterComponentId;
      const { data: newMasterComp, error: newMasterError } = await db
        .from('master_components')
        .select('*')
        .eq('id', finalNewMasterComponentId)
        .single();

      if (newMasterError || !newMasterComp) {
        throw new Error('Selected replacement component not found in database.');
      }

      newComponentSize = newMasterComp.size;
      newComponentDetails = {
        name: newMasterComp.name,
        brand: newMasterComp.brand,
        model: newMasterComp.model,
        series: newMasterComp.series,
        size: newMasterComp.size,
        system: newMasterComp.system,
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

      // Upsert the new master component
      await db.from('master_components').upsert(
        { id: finalNewMasterComponentId, ...cleanNewComponentDetails },
        { onConflict: 'id' }
      );
    }

    const existingLog = Array.isArray(equipment.maintenance_log)
      ? equipment.maintenance_log
      : [];

    const newLogEntry: MaintenanceLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      componentName: masterComponentToReplace.name,
      serviceType: 'replaced',
      notes: `Replaced ${masterComponentToReplace.brand || ''} ${masterComponentToReplace.model || ''} with ${newComponentDetails.brand || ''} ${newComponentDetails.model || ''}. Reason: ${replacementReason}.`,
      shopId,
      shopName,
    };

    // Update equipment with new maintenance log
    await db
      .from('equipment')
      .update({
        maintenance_log: [...existingLog, newLogEntry],
      })
      .eq('id', equipmentId)
      .eq('user_id', userId);

    // Update the component with new master component reference
    const cleanData = {
      master_component_id: finalNewMasterComponentId,
      wear_percentage: 0,
      total_distance: 0,
      total_hours: 0,
      purchase_date: new Date().toISOString(),
      notes: `Replaced by ${shopName} on ${new Date().toLocaleDateString()}`,
      size: newComponentSize,
      parent_user_component_id: componentToReplace.parent_user_component_id,
    };

    await db
      .from('components')
      .update(cleanData)
      .eq('id', userComponentIdToReplace)
      .eq('equipment_id', equipmentId)
      .eq('user_id', userId);

    return { success: true, message: 'Component replaced successfully.' };
  } catch (error) {
    console.error('[SERVER ACTION ERROR] in replaceUserComponentAction:', error);
    if ((error as any).code === 'PGRST116' || (error as any).code === 'permission-denied') {
      throw new Error('A permission error occurred. This may be due to access rules.');
    }
    throw new Error((error as Error).message || 'An unexpected error occurred during component replacement.');
  }
}
