
'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, DocumentData, doc, updateDoc, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Sparkles, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { WorkOrderDetailSheet } from "@/components/work-order-detail-sheet";

export type WorkOrderStatus =
  | "New"
  | "Customer Contacted"
  | "Appointment Booked"
  | "Bike in Shop"
  | "Awaiting Parts"
  | "Awaiting Service"
  | "In Service"
  | "Testing"
  | "Bike Ready"
  | "Completed";

export type WorkOrder = {
  id: string;
  customerName: string;
  bike: string;
  issueDescription: string;
  createdAt: string;
  status: WorkOrderStatus;
  priority?: "Low" | "Medium" | "High";
  priorityLoading?: boolean;
  userEmail: string;
  userPhone: string;
  notes: string;
  equipmentName: string;
};

export const allStatuses: WorkOrderStatus[] = [
  "New",
  "Customer Contacted",
  "Appointment Booked",
  "Bike in Shop",
  "Awaiting Parts",
  "Awaiting Service",
  "In Service",
  "Testing",
  "Bike Ready",
  "Completed",
];

export const statusVariant: { [key in WorkOrderStatus]: "default" | "secondary" | "destructive" | "outline" } = {
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

const priorityVariant: { [key in NonNullable<WorkOrder['priority']>]: "default" | "secondary" | "destructive" } = {
  "Low": "outline",
  "Medium": "secondary",
  "High": "destructive"
};

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<WorkOrderStatus | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    };

    setLoading(true);
    const q = query(
        collection(db, "workOrders"), 
        where("serviceProviderId", "==", user.uid),
        orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const orders: WorkOrder[] = [];
      querySnapshot.forEach((doc: DocumentData) => {
        const data = doc.data();
        
        let status: WorkOrderStatus = 'New';
        if (allStatuses.includes(data.status)) {
            status = data.status;
        } else if (data.status === 'pending') {
            status = 'New';
        }

        orders.push({
          id: doc.id,
          customerName: data.userName || 'N/A',
          bike: data.equipmentBrand && data.equipmentModel ? `${data.equipmentBrand} ${data.equipmentModel}` : 'N/A',
          issueDescription: data.serviceType || 'No description',
          createdAt: data.createdAt?.toDate().toLocaleDateString() || 'N/A',
          status: status,
          userEmail: data.userEmail || '',
          userPhone: data.userPhone || '',
          notes: data.notes || '',
          equipmentName: data.equipmentName || '',
        });
      });
      setWorkOrders(orders.sort((a,b) => (a.status === 'Completed' ? 1 : -1) - (b.status === 'Completed' ? 1: -1) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (error) => {
        console.error("Error fetching work orders: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleGetPriority = (id: string) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, priorityLoading: true } : wo));
    
    // Simulate AI call
    setTimeout(() => {
        const priorities: Array<WorkOrder['priority']> = ["Low", "Medium", "High"];
        const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
        setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, priority: randomPriority, priorityLoading: false } : wo));
    }, 1500);
  };
  
  const handleViewDetails = (order: WorkOrder) => {
    setSelectedWorkOrder(order);
    setIsSheetOpen(true);
  }
  
  const handleOpenStatusDialog = (order: WorkOrder) => {
      setSelectedWorkOrder(order);
      setStatusToUpdate(order.status);
      setIsStatusDialogOpen(true);
  }

  const handleUpdateStatus = async () => {
    if (!selectedWorkOrder || !statusToUpdate) return;

    setUpdatingStatus(true);
    const workOrderRef = doc(db, "workOrders", selectedWorkOrder.id);

    try {
        await updateDoc(workOrderRef, {
            status: statusToUpdate
        });
        toast({ title: "Success", description: "Work order status updated."});
        setIsStatusDialogOpen(false);
        setSelectedWorkOrder(null);
    } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to update status.", variant: "destructive"});
    } finally {
        setUpdatingStatus(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold text-primary">Work Orders</h1>
        <Button className="bg-accent hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Work Order
        </Button>
      </div>
      
      <div className="rounded-lg border">
         {loading ? (
           <div className="flex items-center justify-center p-8">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
         ) : workOrders.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
                <p>No work orders found.</p>
                <p className="text-sm">When an athlete submits a work order for your shop, it will appear here.</p>
            </div>
         ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Bike</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((order) => (
                <TableRow key={order.id} className={order.status === 'Completed' ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{order.customerName}</TableCell>
                  <TableCell>{order.bike}</TableCell>
                  <TableCell>{order.issueDescription}</TableCell>
                  <TableCell>{order.createdAt}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {order.priority ? (
                      <Badge variant={priorityVariant[order.priority]}>{order.priority}</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleGetPriority(order.id)} disabled={order.priorityLoading}>
                        {order.priorityLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4 text-accent" />
                        )}
                        Get Priority
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleViewDetails(order)}>
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleOpenStatusDialog(order)}>Update Status</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500">Cancel Order</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Update Status</DialogTitle>
                <DialogDescription>
                    Select the new status for work order #{selectedWorkOrder?.id.substring(0, 7)}.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="status-select">Status</Label>
                <Select value={statusToUpdate ?? undefined} onValueChange={(value: WorkOrderStatus) => setStatusToUpdate(value)}>
                    <SelectTrigger id="status-select">
                        <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                        {allStatuses.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateStatus} disabled={updatingStatus} className="bg-accent hover:bg-accent/90">
                    {updatingStatus ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : 'Save'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedWorkOrder && (
        <WorkOrderDetailSheet
            isOpen={isSheetOpen}
            onOpenChange={setIsSheetOpen}
            workOrder={selectedWorkOrder}
        />
      )}
    </div>
  );
}

    

    