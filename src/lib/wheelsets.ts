
import { z } from 'zod';
import { db } from '@/lib/supabase';

const WheelsetDataSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  type: z.literal('Wheelset'),
});

export type CreateWheelsetInput = z.infer<typeof WheelsetDataSchema> & {
  userId: string;
  parentEquipmentId: string;
};

export async function createWheelset(input: CreateWheelsetInput): Promise<void> {
  const { userId, parentEquipmentId, name, brand, model, type } = input;

  if (!userId) {
    throw new Error('User ID is required to create a wheelset.');
  }

  const wheelsetId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newWheelsetPayload = {
    id: wheelsetId,
    user_id: userId,
    name,
    brand: brand || null,
    model: model || null,
    type,
    created_at: now,
    total_distance: 0,
    total_hours: 0,
    components: [],
    maintenance_log: [],
  };

  try {
    // Insert new wheelset
    const { error: insertError } = await db
      .from('equipment')
      .insert([newWheelsetPayload]);

    if (insertError) throw insertError;

    // Update parent equipment with associated wheelset ID
    const { error: updateError } = await db
      .from('equipment')
      .update({
        associated_equipment_ids: [wheelsetId],
      })
      .eq('id', parentEquipmentId)
      .eq('user_id', userId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error creating wheelset:', error);
    throw new Error('Failed to create wheelset. The operation could not be completed.');
  }
}
