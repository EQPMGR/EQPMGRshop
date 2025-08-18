
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import type { WorkOrder, WorkOrderStatus } from '@/app/dashboard/work-orders/page';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

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

    