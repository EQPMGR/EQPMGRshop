
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { MaintenanceLog as MaintenanceLogType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Wrench } from 'lucide-react';
import { formatDate, toDate } from '@/lib/date-utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';


interface MaintenanceLogProps {
  log: MaintenanceLogType[];
  onAddLog: (log: Omit<MaintenanceLogType, 'id' | 'shopId' | 'shopName'>) => void;
}

export function MaintenanceLog({ log, onAddLog }: MaintenanceLogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
      date: new Date(),
      componentName: '',
      serviceType: 'serviced' as 'serviced' | 'replaced' | 'inspected',
      notes: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setNewEntry(prev => ({ ...prev, [name]: value }));
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewEntry(prev => ({ ...prev, [name]: toDate(value) }));
  }

  const handleSelectChange = (value: 'serviced' | 'replaced' | 'inspected') => {
      setNewEntry(prev => ({...prev, serviceType: value}));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddLog(newEntry);
    setNewEntry({
        date: new Date(),
        componentName: '',
        serviceType: 'serviced',
        notes: ''
    });
    setIsOpen(false);
  }

  const sortedLog = [...log].sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime());


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Maintenance Log</CardTitle>
         <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                 <Button variant="ghost" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Entry
                </Button>
            </CollapsibleTrigger>
        </Collapsible>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleContent>
                <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4 mb-4">
                     <h4 className="font-medium">New Log Entry</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Input id="date" name="date" type="date" value={format(newEntry.date, 'yyyy-MM-dd')} onChange={handleDateChange} required />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="componentName">Component</Label>
                            <Input id="componentName" name="componentName" placeholder="e.g., Chain" value={newEntry.componentName} onChange={handleInputChange} required />
                        </div>
                     </div>
                     <div className="space-y-2">
                         <Label htmlFor="serviceType">Service Type</Label>
                         <Select onValueChange={handleSelectChange} value={newEntry.serviceType}>
                            <SelectTrigger id="serviceType">
                                <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="serviced">Serviced</SelectItem>
                                <SelectItem value="replaced">Replaced</SelectItem>
                                <SelectItem value="inspected">Inspected</SelectItem>
                            </SelectContent>
                         </Select>
                     </div>
                     <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" name="notes" placeholder="Describe the work done..." value={newEntry.notes} onChange={handleInputChange} />
                     </div>
                     <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Entry</Button>
                     </div>
                </form>
            </CollapsibleContent>
        </Collapsible>

        {sortedLog.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No maintenance history recorded.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedLog.map((entry) => (
                <div key={entry.id} className="flex gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Wrench className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <p className="font-medium">{entry.componentName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">{entry.serviceType}</p>
                        {entry.shopName && <p className="text-xs text-muted-foreground">Serviced by: {entry.shopName}</p>}
                        <p className="text-sm mt-1">{entry.notes}</p>
                    </div>
                </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
