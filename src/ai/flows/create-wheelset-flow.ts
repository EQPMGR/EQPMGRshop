
import { z } from 'zod';
import { doc, writeBatch, collection, serverTimestamp } from '@/lib/firestore-compat';
import { db } from '@/lib/firebase';

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

  const batch = writeBatch(db);

  const newWheelsetRef = doc(collection(db, 'users', userId, 'equipment'));
  const newWheelsetPayload = {
    id: newWheelsetRef.id,
    name,
    brand: brand || null,
    model: model || null,
    type,
    createdAt: serverTimestamp(),
    totalDistance: 0,
    totalHours: 0,
    components: [],
    maintenanceLog: [],
  };

  batch.set(newWheelsetRef, newWheelsetPayload);

  const parentEquipmentRef = doc(db, 'users', userId, 'equipment', parentEquipmentId);
  batch.update(parentEquipmentRef, {
    associatedEquipmentIds: [newWheelsetRef.id],
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error creating wheelset in batch:', error);
    throw new Error('Failed to create wheelset. The operation could not be completed.');
  }
}
