

'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { WorkOrderDetailSheet } from "@/components/work-order-detail-sheet";
import { UpdateStatusDialog } from "@/components/update-status-dialog";

import type { WorkOrder, WorkOrderStatus } from '@/lib/types';
import { allStatuses, statusVariant } from '@/lib/types';

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

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

  const handleViewDetails = (order: WorkOrder) => {
    setSelectedWorkOrder(order);
    setIsSheetOpen(true);
  }
  
  const handleOpenStatusDialog = (order: WorkOrder) => {
      setSelectedWorkOrder(order);
      setIsStatusDialogOpen(true);
  }

  const handleStatusUpdated = (id: string, status: WorkOrderStatus) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status } : wo));
    setSelectedWorkOrder(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold text-primary">Work Orders</h1>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <UpdateStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        workOrder={selectedWorkOrder}
        onUpdated={handleStatusUpdated}
      />

      {selectedWorkOrder && (
        <WorkOrderDetailSheet
            isOpen={isSheetOpen}
            onOpenChange={setIsSheetOpen}
            workOrder={selectedWorkOrder}
            onStatusUpdated={handleStatusUpdated}
        />
      )}
    </div>
  );
}
