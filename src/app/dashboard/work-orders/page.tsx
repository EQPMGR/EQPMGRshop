

'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { WorkOrderDetailSheet } from "@/components/work-order-detail-sheet";

import type { WorkOrder, WorkOrderStatus } from '@/lib/types';
import { allStatuses, statusVariant } from '@/lib/types';

const priorityVariant: { [key in NonNullable<WorkOrder['priority']>]: "default" | "secondary" | "destructive" } = {
  "Low": "secondary",
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

    // Helper function to fetch and process work orders
    const fetchWorkOrders = async () => {
      try {
        const { data, error } = await db
          .from('work_orders')
          .select('*')
          .eq('service_provider_id', user.uid);

        if (error) throw error;

        const orders: WorkOrder[] = (data || []).map((row: any) => {
          let status: WorkOrderStatus = 'New';
          if (allStatuses.includes(row.status)) {
            status = row.status;
          } else if (row.status === 'pending') {
            status = 'New';
          }

          return {
            id: row.id,
            customerName: row.user_name || 'N/A',
            bike: row.equipment_brand && row.equipment_model ? `${row.equipment_brand} ${row.equipment_model}` : 'N/A',
            issueDescription: row.service_type || 'No description',
            createdAt: row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A',
            status: status,
            userEmail: row.user_email || '',
            userPhone: row.user_phone || '',
            notes: row.notes || '',
            equipmentName: row.equipment_name || '',
            userId: row.user_id || '',
            equipmentId: row.equipment_id || '',
          };
        });

        // Sort client-side to avoid index requirement & complex sorting
        const sortedOrders = orders.sort((a, b) => {
          if (a.status === 'Completed' && b.status !== 'Completed') return 1;
          if (a.status !== 'Completed' && b.status === 'Completed') return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setWorkOrders(sortedOrders);
        setLoading(false);
      } catch (error: any) {
        console.error("Error fetching work orders: ", error);
        toast({ title: "Error", description: "Could not fetch work orders.", variant: "destructive" });
        setLoading(false);
      }
    };

    // Initial fetch
    fetchWorkOrders();

    // Subscribe to real-time updates
    const channel = db
      .channel(`work_orders:${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders',
          filter: `service_provider_id=eq.${user.uid}`,
        },
        () => {
          fetchWorkOrders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, toast]);

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

    try {
      const { error } = await db
        .from('work_orders')
        .update({ status: statusToUpdate })
        .eq('id', selectedWorkOrder.id);

      if (error) throw error;

      toast({ title: "Success", description: "Work order status updated." });
      setIsStatusDialogOpen(false);
      setSelectedWorkOrder(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update status.", variant: "destructive" });
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
