import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWebsiteSchema } from "@shared/schema";
import { useCreateWebsite } from "@/hooks/use-websites";
import { useToast } from "@/hooks/use-toast";
import type { z } from "zod";

type FormData = z.infer<typeof insertWebsiteSchema>;

export function CreateWebsiteDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createWebsite = useCreateWebsite();

  const form = useForm<FormData>({
    resolver: zodResolver(insertWebsiteSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      imageUrl: "",
      isVisible: true,
      order: 0,
    },
  });

  const onSubmit = (data: FormData) => {
    createWebsite.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Website added",
          description: "Your portfolio item has been created successfully.",
        });
        setOpen(false);
        form.reset();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-transparent border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Website
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add New Website</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Website Name</Label>
            <Input id="name" {...form.register("name")} placeholder="My Awesome Project" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input id="url" {...form.register("url")} placeholder="https://example.com" />
            {form.formState.errors.url && (
              <p className="text-sm text-destructive">{form.formState.errors.url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image/Logo URL</Label>
            <Input id="imageUrl" {...form.register("imageUrl")} placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              {...form.register("description")} 
              placeholder="Brief description of the project..."
              className="resize-none h-24"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWebsite.isPending} className="bg-primary text-primary-foreground">
              {createWebsite.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                </>
              ) : (
                "Add to Portfolio"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
