"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_MEMBER_ID } from "@/lib/constants";
import {
  extractErrorMessage,
  formatAddress,
  formatMultiField,
} from "@/lib/utils";
import {
  useDeleteContactMutation,
  useGetContactDetailsQuery,
} from "@/state/api";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const ContactDetailPage = () => {
  const { id: contactId } = useParams<{ id: string }>();
  const router = useRouter();
  const memberId = DEFAULT_MEMBER_ID;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: contact,
    error,
    isLoading,
  } = useGetContactDetailsQuery(
    { memberId, contactId },
    { skip: !memberId || !contactId }
  );

  const [deleteContact, { isLoading: isDeleting }] = useDeleteContactMutation();

  const handleDelete = async () => {
    try {
      await deleteContact({ memberId, contactId }).unwrap();
      toast(`Contact ${contactId} has been successfully deleted.`);
      router.push("/contacts");
    } catch (err: any) {
      toast(`Error deleting contact: ${err.data?.message || err.message}`);
      console.error("Failed to delete contact:", err);
    } finally {
      setShowDeleteDialog(false);
    }
  };

  if (!memberId || !contactId) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading contact information...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Contact Details</h1>
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <p>Fetching contact...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = extractErrorMessage(error);
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Contact Details</h1>
        <p className="text-destructive font-medium">
          Error loading contact: {errorMessage}
        </p>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          ← Go Back
        </Button>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Contact Not Found</h1>
        <p className="text-muted-foreground">
          The contact with ID <span className="font-mono">{contactId}</span>{" "}
          does not exist.
        </p>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          ← Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">
            {contact.NAME} {contact.LAST_NAME}
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage contact information.
          </p>
        </div>
        <Link href="/contacts">
          <Button variant="ghost">← Back to Contacts</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Name:</span> {contact.NAME}{" "}
              {contact.LAST_NAME}
            </p>
            <p>
              <span className="font-medium">Phone:</span>{" "}
              {formatMultiField(contact.PHONE)}
            </p>
            <p>
              <span className="font-medium">Email:</span>{" "}
              {formatMultiField(contact.EMAIL)}
            </p>
            <p>
              <span className="font-medium">Website:</span>{" "}
              {formatMultiField(contact.WEB)}
            </p>
            <p>
              <span className="font-medium">Address:</span>{" "}
              {formatAddress(
                contact.ADDRESS_CITY,
                contact.ADDRESS_REGION,
                contact.ADDRESS_PROVINCE
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {contact.requisite ? (
              <>
                <p>
                  <span className="font-medium">Account Name:</span>{" "}
                  {contact.requisite.NAME || "—"}
                </p>
                <p>
                  <span className="font-medium">Bank:</span>{" "}
                  {contact.requisite.RQ_BANK_NAME || "—"}
                </p>
                <p>
                  <span className="font-medium">Account #:</span>{" "}
                  {contact.requisite.RQ_ACC_NUM || "—"}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                No banking info available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Link href={`/contacts/edit/${contactId}`}>
          <Button>Edit</Button>
        </Link>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
              <AlertDialogDescription>
                This action is irreversible. The contact and all related data
                will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ContactDetailPage;
