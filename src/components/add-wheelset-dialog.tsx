
'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Equipment } from '@/lib/types';
import { createWheelset } from '@/ai/flows/create-wheelset-flow';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams } from 'next/navigation';

const wheelsetSchema = z.object({
  name: z.string().min(1, 'Wheelset name is required.'),
  brand: z.string().optional(),
  model: z.string().optional(),
});

type WheelsetFormValues = z.infer<typeof wheelsetSchema>;

interface AddWheelsetDialogProps {
  children: React.ReactNode;
  equipment: Equipment; // This is the parent bike
  onSuccess: () => void;
}

export function AddWheelsetDialog({ children, equipment, onSuccess }: AddWheelsetDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('userId');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<WheelsetFormValues>({
    resolver: zodResolver(wheelsetSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      brand: '',
      model: '',
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
    }
    setOpen(isOpen);
  };

  const onSubmit = async (data: WheelsetFormValues) => {
    if (!clientId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Client ID is missing.' });
      return;
    }
    setIsSaving(true);
    try {
      await createWheelset({
        userId: clientId,
        parentEquipmentId: equipment.id,
        wheelsetData: {
          name: data.name,
          brand: data.brand,
          model: data.model,
          type: 'Wheelset', // Set the type explicitly
        },
      });

      toast({
        title: 'Wheelset Added',
        description: `${data.name} has been added to ${equipment.name}.`,
      });
      onSuccess();
      handleOpenChange(false);
    } catch (error: any) {
      console.error('Failed to add wheelset:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Wheelset</DialogTitle>
          <DialogDescription>
            Add a new wheelset to &quot;{equipment.name}&quot;. It will be created as a separate piece
            of equipment and linked to this bike.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Wheelset Name</Label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input id="name" placeholder="e.g., Carbon Race Wheels" {...field} />
              )}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Controller
                name="brand"
                control={control}
                render={({ field }) => <Input id="brand" placeholder="e.g., Zipp" {...field} />}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Controller
                name="model"
                control={control}
                render={({ field }) => <Input id="model" placeholder="e.g., 454 NSW" {...field} />}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !isValid}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Wheelset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
