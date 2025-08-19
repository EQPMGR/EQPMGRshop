
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Equipment, BikeFitData, CleatPosition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Separator } from './ui/separator';
import { BikeFitDiagram } from './icons/bike-fit-diagram';

const cleatPositionSchema = z.object({
  foreAft: z.coerce.number().optional(),
  lateral: z.coerce.number().optional(),
  rotational: z.coerce.number().optional(),
});


const fitFormSchema = z.object({
  saddleHeight: z.coerce.number().optional(),
  saddleHeightOverBars: z.coerce.number().optional(),
  saddleToHandlebarReach: z.coerce.number().optional(),
  saddleAngle: z.coerce.number().optional(),
  saddleForeAft: z.coerce.number().optional(),
  saddleBrandModel: z.string().optional(),
  stemLength: z.coerce.number().optional(),
  stemAngle: z.coerce.number().optional(),
  handlebarBrandModel: z.string().optional(),
  handlebarWidth: z.coerce.number().optional(),
  handlebarAngle: z.coerce.number().optional(),
  handlebarExtension: z.coerce.number().optional(),
  brakeLeverPosition: z.string().optional(),
  crankLength: z.coerce.number().optional(),
  hasAeroBars: z.boolean().default(false),
  cleatPosition: cleatPositionSchema.optional(),
});

type FitFormValues = z.infer<typeof fitFormSchema>;

interface BikeFitDialogProps {
  children: React.ReactNode;
  equipment: Equipment;
  userId: string; // The ID of the client, not the shop owner
  onSuccess: () => void;
}

export function BikeFitDialog({ children, equipment, userId, onSuccess }: BikeFitDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const { toast } = useToast();
  const isShoes = equipment.type === 'Cycling Shoes';

  const form = useForm<FitFormValues>({
    resolver: zodResolver(fitFormSchema),
    defaultValues: equipment.fitData || {
      hasAeroBars: false,
    },
  });
  
  useEffect(() => {
      if (open && equipment.fitData) {
          form.reset(equipment.fitData);
      }
  }, [open, equipment.fitData, form]);

  const hasAeroBars = form.watch('hasAeroBars');

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset(equipment.fitData || { hasAeroBars: false });
    }
  };

  const onSubmit = async (data: FitFormValues) => {
    if (!userId) {
      toast({ variant: 'destructive', title: 'Error', description: 'No client user ID provided.' });
      return;
    }
    setIsSaving(true);
    
    try {
      // Use the passed-in userId to reference the client's document
      const equipmentDocRef = doc(db, 'users', userId, 'equipment', equipment.id);
      
      const cleanedData: Partial<BikeFitData> = {};
      for (const key in data) {
          const typedKey = key as keyof FitFormValues;
          let value = data[typedKey];
          if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
              value = undefined;
          }
          if (value !== undefined) {
             (cleanedData as any)[typedKey] = value;
          }
      }

      await updateDoc(equipmentDocRef, {
        fitData: cleanedData,
      });

      toast({ title: 'Bike Fit Saved!', description: "Client's measurements have been updated." });
      onSuccess();
      handleOpenChange(false);
    } catch (error: any) {
      console.error("Failed to save bike fit data:", error);
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'Check Firestore rules and data.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const renderMeasurementField = (name: keyof FitFormValues, label: string, letter: string, unit: string) => (
     <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{letter}. {label} ({unit})</FormLabel>
            <FormControl>
              <Input type="number" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} value={field.value ?? ''} />
            </FormControl>
          </FormItem>
        )}
      />
  );
  
  const renderTextField = (name: keyof FitFormValues, label: string, letter: string) => (
     <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{letter}. {label}</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ''} />
            </FormControl>
          </FormItem>
        )}
      />
  );
  
  const renderCleatField = (name: keyof CleatPosition, label: string) => (
     <FormField
        control={form.control}
        name={`cleatPosition.${name}` as any}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Input type="number" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} value={field.value ?? ''} />
            </FormControl>
             <FormMessage />
          </FormItem>
        )}
      />
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isShoes ? 'Cleat Position' : 'Bike Fit Details'}</DialogTitle>
          <DialogDescription>
            {isShoes ? 'Enter your cleat placement measurements.' : 'Enter your bike fit measurements below. All measurements are from the center line unless otherwise specified.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className={`grid ${!isShoes && 'md:grid-cols-2'} gap-x-8 flex-1 min-h-0`}>
          {!isShoes && (
             <div className="relative md:sticky md:top-0 h-fit md:h-full flex flex-col items-center justify-center py-4 md:border-r md:pr-6">
                <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center p-4">
                    <BikeFitDiagram className="w-full h-full object-contain" />
                </div>
            </div>
          )}
          
          <div className="flex flex-col min-h-0">
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-6">
                       
                       {!isShoes && (
                         <>
                            <RadioGroup
                                value={units}
                                onValueChange={(value: 'metric' | 'imperial') => setUnits(value)}
                                className="flex space-x-4"
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="metric" /></FormControl>
                                <FormLabel className="font-normal">Metric (mm/deg)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="imperial" /></FormControl>
                                <FormLabel className="font-normal">Imperial (in/deg)</FormLabel>
                                </FormItem>
                            </RadioGroup>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                {renderMeasurementField('saddleHeight', 'Saddle Height', 'A', units === 'metric' ? 'mm' : 'in')}
                                {renderMeasurementField('saddleHeightOverBars', 'Saddle Height Over Bars', 'B', units === 'metric' ? 'mm' : 'in')}
                                {renderMeasurementField('saddleToHandlebarReach', 'Saddle to Handlebar Reach', 'C', units === 'metric' ? 'mm' : 'in')}
                                {renderMeasurementField('saddleAngle', 'Saddle Angle', 'D', 'deg')}
                                {renderMeasurementField('saddleForeAft', 'Saddle Fore-Aft', 'E', units === 'metric' ? 'mm' : 'in')}
                                {renderTextField('saddleBrandModel', 'Saddle Brand and Model', 'F')}
                                {renderMeasurementField('stemLength', 'Stem Length', 'G', 'mm')}
                                {renderMeasurementField('stemAngle', 'Stem Angle', 'H', 'deg')}
                                {renderTextField('handlebarBrandModel', 'Handlebar Brand and Model', 'I')}
                                {renderMeasurementField('handlebarWidth', 'Handlebar Width', 'J', units === 'metric' ? 'mm' : 'in')}
                                {renderMeasurementField('handlebarAngle', 'Handlebar Angle', 'K', 'deg')}
                                {renderMeasurementField('handlebarExtension', 'Handlebar Extension', 'L', 'mm')}
                                {renderTextField('brakeLeverPosition', 'Brake Lever Position', 'M')}
                                {renderMeasurementField('crankLength', 'Crank Length', 'N', 'mm')}
                            </div>
                        
                            <Separator />
                            
                            <FormField
                                control={form.control}
                                name="hasAeroBars"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                    <FormLabel>Aero Bar Setup</FormLabel>
                                    <FormDescription>
                                        Enable this to add aero bar specific measurements.
                                    </FormDescription>
                                    </div>
                                    <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    </FormControl>
                                </FormItem>
                                )}
                            />

                            {hasAeroBars && (
                                <div className="p-4 border-l-2 ml-2 space-y-4">
                                    <p className="text-muted-foreground">Aero bar setup fields will go here.</p>
                                </div>
                            )}
                         </>
                       )}
                       
                       {isShoes && (
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                               {renderCleatField('foreAft', 'Fore-Aft')}
                               {renderCleatField('lateral', 'Lateral')}
                               {renderCleatField('rotational', 'Rotational (deg)')}
                           </div>
                       )}

                    </div>

                    <DialogFooter className="pt-4 mt-auto border-t">
                        <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Fit Details
                        </Button>
                    </DialogFooter>
                </form>
             </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
