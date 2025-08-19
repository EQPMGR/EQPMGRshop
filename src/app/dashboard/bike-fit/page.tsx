
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BikeFitDialog } from '@/components/bike-fit-dialog';
import type { Equipment } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// This is a placeholder for demonstration purposes.
// In a real application, you would fetch this data based on the selected customer/work order.
const MOCK_EQUIPMENT: Equipment = {
  id: 'DEMO_EQUIPMENT_ID', // A mock equipment ID
  name: 'Trek Emonda',
  type: 'Road Bike',
  brand: 'Trek',
  model: 'Emonda',
  fitData: {
      saddleHeight: 750,
      saddleToHandlebarReach: 550,
  }
};

// This is a placeholder for demonstration purposes.
const MOCK_CLIENT_ID = 'DEMO_CLIENT_ID'; // A mock client user ID

export default function BikeFitPage() {
  const [equipment] = useState<Equipment>(MOCK_EQUIPMENT);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold text-primary">Bike Fit</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Client & Equipment Selection</CardTitle>
          <CardDescription>
            Select a client and their equipment to view or edit their bike fit data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
                In a real scenario, you would search for a client or select them from a work order. For now, we are using mock data.
            </p>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Client ID</Label>
                    <Input value={MOCK_CLIENT_ID} readOnly disabled />
                </div>
                 <div>
                    <Label>Equipment ID</Label>
                    <Input value={equipment.id} readOnly disabled />
                </div>
            </div>
           
            <BikeFitDialog 
                equipment={equipment} 
                userId={MOCK_CLIENT_ID}
                onSuccess={() => console.log("Fit data saved successfully!")}
            >
                <Button className="bg-accent hover:bg-accent/90">View or Edit Bike Fit</Button>
            </BikeFitDialog>

        </CardContent>
      </Card>
    </div>
  );
}
