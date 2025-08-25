
'use client';

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, Replace } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Component, MasterComponent } from '@/lib/types';
import { replaceUserComponentAction } from '../app/dashboard/equipment/admin-actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
  brand: z.string().optional(),
  size: z.string().optional(),
  series: z.string().optional(),
  model: z.string().optional(),
  replacementReason: z.enum(['failure', 'modification', 'upgrade'], {
    required_error: "Please select a reason for replacement."
  }),
  manualBrand: z.string(),
  manualSeries: z.string(),
  manualModel: z.string(),
  manualSize: z.string(),
}).superRefine((data, ctx) => {
    // This validation is tricky because one of the two sections must be filled.
    // We will handle the logic via the button's disabled state.
});

type FormValues = z.infer<typeof formSchema>;

interface ReplaceComponentDialogProps {
  userId: string;
  shopId: string;
  shopName: string;
  equipmentId: string;
  componentToReplace: Component;
  onSuccess: () => void;
}

export function ReplaceComponentDialog({
  userId,
  shopId,
  shopName,
  equipmentId,
  componentToReplace,
  onSuccess,
}: ReplaceComponentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [allComponentOptions, setAllComponentOptions] = useState<MasterComponent[]>([]);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brand: '',
      size: '',
      series: '',
      model: '',
      manualBrand: '',
      manualSeries: '',
      manualModel: '',
      manualSize: '',
    }
  });
  
  const { brand, size, series, model: selectedModelId, manualBrand, replacementReason } = form.watch();

  useEffect(() => {
    if (open) {
      async function loadComponents() {
        setIsLoadingOptions(true);
        try {
          const q = query(collection(db, 'masterComponents'));
          const querySnapshot = await getDocs(q);
          const components = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterComponent));
          setAllComponentOptions(components);
        } catch (error: any) {
            let description = 'Could not load components.';
            if (error.message.includes('firestore/failed-precondition') || error.message.includes('index')) {
                description = 'The database query failed. A Firestore index is likely required. Please check the Firestore console for an index creation link in the error logs.'
            }
            toast({ variant: 'destructive', title: 'Error', description });
        } finally {
          setIsLoadingOptions(false);
        }
      }
      loadComponents();
    }
  }, [open, toast]);

  const componentOptions = useMemo(() => {
    return allComponentOptions.filter(c => c.name === componentToReplace.componentName);
  }, [allComponentOptions, componentToReplace.componentName]);

  const brands = useMemo(() => [...new Set(componentOptions.map(c => c.brand).filter(Boolean))].sort(), [componentOptions]);
  const sizes = useMemo(() => [...new Set(componentOptions.map(c => c.size).filter(Boolean))].sort(), [componentOptions]);
  
  const filteredSeries = useMemo(() => {
      let filtered = componentOptions;
      if (brand) filtered = filtered.filter(c => c.brand === brand);
      if (size) filtered = filtered.filter(c => c.size === size);
      return [...new Set(filtered.map(c => c.series).filter(Boolean))].sort();
  }, [componentOptions, brand, size]);

  const filteredModels = useMemo(() => {
      let filtered = componentOptions;
      if (brand) filtered = filtered.filter(c => c.brand === brand);
      if (size) filtered = filtered.filter(c => c.size === size);
      if (series) filtered = filtered.filter(c => c.series === series);
      return filtered.filter(c => c.model).sort((a,b) => (a.model || '').localeCompare(b.model || ''));
  }, [componentOptions, brand, size, series]);


  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
      setIsSaving(false);
      setIsLoadingOptions(true);
    }
  };

  const callServerAction = async (data: FormValues) => {
      setIsSaving(true);
      
      try {
        const result = await replaceUserComponentAction({
            userId,
            equipmentId,
            userComponentIdToReplace: componentToReplace.id,
            replacementReason: data.replacementReason,
            newMasterComponentId: data.model || null,
            manualNewComponentData: data.manualBrand ? {
                name: componentToReplace.componentName, // Use name from component being replaced
                brand: data.manualBrand,
                series: data.manualSeries,
                model: data.manualModel,
                size: data.manualSize,
            } : null,
            shopId,
            shopName
        });

        toast({ title: 'Success!', description: result.message });
        onSuccess();
        handleOpenChange(false);
      } catch (error: any) {
        console.error('Replacement failed:', error);
        toast({ variant: 'destructive', title: 'Replacement Failed', description: error.message, duration: 9000 });
      } finally {
        setIsSaving(false);
      }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Replace className="mr-2 h-4 w-4" />
          Replace Part
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace: {componentToReplace.componentName}</DialogTitle>
          <DialogDescription>
            Select the new replacement part from the list or add it manually.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(callServerAction)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Replace from Database</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            {isLoadingOptions ? <Loader2 className="animate-spin" /> : (
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="brand" render={({ field }) => ( <FormItem><FormLabel>Brand</FormLabel><Select onValueChange={value => { field.onChange(value); form.setValue('series', ''); form.setValue('model', ''); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Brand" /></SelectTrigger></FormControl><SelectContent>{brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                    <FormField control={form.control} name="size" render={({ field }) => ( <FormItem><FormLabel>Size / Speeds</FormLabel><Select onValueChange={value => { field.onChange(value); form.setValue('series', ''); form.setValue('model', ''); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Size" /></SelectTrigger></FormControl><SelectContent>{sizes.map((s, i) => <SelectItem key={`${s}-${i}`} value={s!}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                    <FormField control={form.control} name="series" render={({ field }) => ( <FormItem><FormLabel>Series</FormLabel><Select onValueChange={value => { field.onChange(value); form.setValue('model', ''); }} value={field.value} disabled={!filteredSeries.length}><FormControl><SelectTrigger><SelectValue placeholder="Select Series" /></SelectTrigger></FormControl><SelectContent>{filteredSeries.map((s, i) => <SelectItem key={`${s}-${i}`} value={s!}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                    <FormField control={form.control} name="model" render={({ field }) => ( <FormItem><FormLabel>Model</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!filteredModels.length}><FormControl><SelectTrigger><SelectValue placeholder="Select Model" /></SelectTrigger></FormControl><SelectContent>{filteredModels.map(m => <SelectItem key={m.id} value={m.id}>{m.model}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>Can't find your part? Add it manually.</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                           <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="manualBrand" render={({ field }) => (<FormItem><FormLabel>Brand</FormLabel><FormControl><Input placeholder="e.g., Shimano" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="manualSize" render={({ field }) => (<FormItem><FormLabel>Size / Speeds</FormLabel><FormControl><Input placeholder="e.g., 10" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="manualSeries" render={({ field }) => (<FormItem><FormLabel>Series</FormLabel><FormControl><Input placeholder="e.g., Tiagra" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="manualModel" render={({ field }) => (<FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="e.g., CS-HG500-10" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
                
                <FormField
                  control={form.control}
                  name="replacementReason"
                  render={({ field }) => (
                    <FormItem className="space-y-3 !mt-6 border-t pt-6">
                      <FormLabel>Reason for Replacement</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex items-center space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="failure" /></FormControl>
                            <FormLabel className="font-normal">Failure</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="modification" /></FormControl>
                            <FormLabel className="font-normal">Modification</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="upgrade" /></FormControl>
                            <FormLabel className="font-normal">Upgrade</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                    <Button type="submit" disabled={isSaving || !replacementReason || (!selectedModelId && !manualBrand)}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Replace Component
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
