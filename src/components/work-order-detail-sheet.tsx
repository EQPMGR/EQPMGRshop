

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import type { WorkOrder, WorkOrderStatus } from '@/app/dashboard/work-orders/page';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { BikeFitDialog } from './bike-fit-dialog';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Equipment } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkOrderDetailSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workOrder: WorkOrder | null;
}

export function WorkOrderDetailSheet({
  isOpen,
  onOpenChange,
  workOrder,
}: WorkOrderDetailSheetProps) {
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const { toast } = useToast();

  const fetchEquipmentData = async () => {
    if (isOpen && workOrder?.userId && workOrder?.equipmentId) {
        setLoadingEquipment(true);
        try {
          const equipmentDocRef = doc(db, 'users', workOrder.userId, 'equipment', workOrder.equipmentId);
          const docSnap = await getDoc(equipmentDocRef);
          if (docSnap.exists()) {
            setEquipment({ id: docSnap.id, ...docSnap.data() } as Equipment);
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Could not find the equipment associated with this work order.',
            });
            setEquipment(null);
          }
        } catch (error) {
          console.error("Error fetching equipment:", error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to fetch equipment data. Check security rules.',
          });
          setEquipment(null);
        } finally {
          setLoadingEquipment(false);
        }
      } else {
        setEquipment(null);
      }
  }

  useEffect(() => {
    fetchEquipmentData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, workOrder, toast]);


  if (!workOrder) {
    return null;
  }

  const statusVariant: { [key in WorkOrderStatus]: "default" | "secondary" | "destructive" | "outline" } = {
    "New": "default",
    "Customer Contacted": "secondary",
    "Appointment Booked": "secondary",
    "Bike in Shop": "secondary",
    "Awaiting Parts": "destructive",
    "Awaiting Service": "secondary",
    "In Service": "secondary",
    "Testing": "secondary",
    "Bike Ready": "outline",
    "Completed": "outline",
  };

  const handleFitDataSuccess = () => {
     fetchEquipmentData();
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-headline text-primary">Work Order Details</SheetTitle>
          <SheetDescription>
            Review the details for work order #{workOrder.id.substring(0, 7)}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 py-6">
          {/* Customer Information */}
          <div className="space-y-2">
             <h3 className="font-semibold text-foreground">Customer Information</h3>
             <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-foreground">{workOrder.customerName}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground">{workOrder.userEmail}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium text-foreground">{workOrder.userPhone}</span>
                </div>
             </div>
          </div>

          {/* Equipment Information */}
           <div className="space-y-2">
             <h3 className="font-semibold text-foreground">Equipment Details</h3>
             <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Bike</span>
                    <span className="font-medium text-foreground">{workOrder.bike}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Nickname</span>
                    <span className="font-medium text-foreground">{workOrder.equipmentName}</span>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                    {loadingEquipment ? (
                        <Button disabled className="w-full">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading Fit Data...
                        </Button>
                    ) : equipment ? (
                       <>
                         <BikeFitDialog 
                            equipment={equipment} 
                            userId={workOrder.userId}
                            onSuccess={handleFitDataSuccess}
                        >
                            <Button className="w-full bg-accent hover:bg-accent/90">Edit Bike Fit</Button>
                         </BikeFitDialog>
                         <Button variant="secondary" asChild>
                            <Link href={`/dashboard/equipment/${equipment.id}?userId=${workOrder.userId}`}>
                                View Full Equipment Record
                            </Link>
                         </Button>
                       </>
                    ) : (
                         <Button disabled variant="outline" className="w-full">No Equipment Found</Button>
                    )}
                </div>
             </div>
          </div>
          
           {/* Service Information */}
           <div className="space-y-2">
             <h3 className="font-semibold text-foreground">Service Details</h3>
             <div className="rounded-md border p-4 space-y-4 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Date Received</span>
                    <span className="font-medium text-foreground">{workOrder.createdAt}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={statusVariant[workOrder.status]}>{workOrder.status}</Badge>
                </div>
                 <div className="space-y-1">
                    <span className="text-muted-foreground">Issue Reported</span>
                    <p className="font-medium text-foreground">{workOrder.issueDescription}</p>
                </div>
                 <div className="space-y-1">
                    <span className="text-muted-foreground">Customer Notes</span>
                    <p className="font-medium text-foreground italic">
                        {workOrder.notes || "No notes provided."}
                    </p>
                </div>
             </div>
          </div>

           {/* Internal Notes */}
           <div className="space-y-2">
             <h3 className="font-semibold text-foreground">Internal Shop Notes</h3>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="message">Add notes for your team</Label>
                <Textarea placeholder="e.g., 'Ordered part XYZ, expecting arrival on Friday.'" id="message" />
                <Button size="sm" className="w-fit self-end bg-accent hover:bg-accent/90">Add Note</Button>
            </div>
          </div>

        </div>
        <SheetFooter>
            <div className="w-full flex justify-end gap-2">
                 <Button variant="outline">Print Work Order</Button>
                 <Button className="bg-accent hover:bg-accent/90">Update Status</Button>
            </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
