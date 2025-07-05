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
import {
  useDeleteContactMutation,
  useGetContactDetailsQuery,
} from "@/state/api";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { SerializedError } from "@reduxjs/toolkit/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface ContactDetailPageProps {
  params: {
    id: string; // The contact ID from the URL
  };
}

const ContactDetailPage = () => {
  const { id: contactId } = useParams<ContactDetailPageProps["params"]>();
  const router = useRouter();

  // IMPORTANT: Replace with your actual memberId or implement a proper way to retrieve it
  const memberId = "e3b04fcf454a94d025ceb96c93423068";

  const {
    data: contact,
    error,
    isLoading,
  } = useGetContactDetailsQuery(
    { memberId, contactId },
    { skip: !memberId || !contactId } // Skip fetching if memberId or contactId is not available
  );

  const [deleteContact, { isLoading: isDeleting }] = useDeleteContactMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!memberId || !contactId) {
    return (
      <div className="container mx-auto p-4">
        <p>Loading contact ID...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Contact Details</h1>
        <p>Loading contact details...</p>
      </div>
    );
  }

  if (error) {
    let errorMessage = "An unknown error occurred";

    if ("status" in error) {
      // FetchBaseQueryError
      const fetchError = error as FetchBaseQueryError;
      if (typeof fetchError.data === "string") {
        errorMessage = fetchError.data;
      } else if (
        typeof fetchError.data === "object" &&
        fetchError.data !== null &&
        "message" in fetchError.data
      ) {
        errorMessage =
          (fetchError.data as { message?: string }).message || errorMessage;
      }
    } else if ("message" in error) {
      // SerializedError
      errorMessage = (error as SerializedError).message || errorMessage;
    }

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Contact Details</h1>
        <p className="text-red-500">
          Error loading contact details: {errorMessage}
        </p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Contact Not Found</h1>
        <p>The contact with ID {contactId} could not be found.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteContact({ memberId, contactId }).unwrap();
      toast(`Contact ${contactId} has been successfully deleted.`);
      router.push("/contacts"); // Redirect back to the contact list
    } catch (err: any) {
      toast(`Error deleting contact: ${err.data?.message || err.message}`);
      console.error("Failed to delete contact:", err);
    } finally {
      setShowDeleteDialog(false); // Close dialog
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {contact.NAME} {contact.LAST_NAME}
        </h1>
        <Link href="/contacts">
          <Button variant="outline">Back to Contacts</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Name:</strong> {contact.NAME} {contact.LAST_NAME}
            </p>
            {contact.SECOND_NAME && (
              <p>
                <strong>Middle Name:</strong> {contact.SECOND_NAME}
              </p>
            )}
            <p>
              <strong>Phone:</strong>{" "}
              {contact.PHONE && contact.PHONE.length > 0
                ? contact.PHONE[0].VALUE
                : "N/A"}
            </p>
            <p>
              <strong>Email:</strong>{" "}
              {contact.EMAIL && contact.EMAIL.length > 0
                ? contact.EMAIL[0].VALUE
                : "N/A"}
            </p>
            <p>
              <strong>Website:</strong>{" "}
              {contact.WEB && contact.WEB.length > 0
                ? contact.WEB[0].VALUE
                : "N/A"}
            </p>
            <p>
              <strong>Address:</strong>{" "}
              {contact.ADDRESS_CITY ||
              contact.ADDRESS_REGION ||
              contact.ADDRESS_PROVINCE
                ? `${contact.ADDRESS_CITY || ""}${
                    contact.ADDRESS_CITY &&
                    (contact.ADDRESS_REGION || contact.ADDRESS_PROVINCE)
                      ? ", "
                      : ""
                  }${contact.ADDRESS_REGION || ""}${
                    contact.ADDRESS_REGION && contact.ADDRESS_PROVINCE
                      ? ", "
                      : ""
                  }${contact.ADDRESS_PROVINCE || ""}`.trim()
                : "N/A"}
            </p>
          </CardContent>
        </Card>

        {/* Banking Requisite Card */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contact.requisite ? (
              <>
                <p>
                  <strong>Requisite Name:</strong>{" "}
                  {contact.requisite.NAME || "N/A"}
                </p>
                <p>
                  <strong>Bank Name:</strong>{" "}
                  {contact.requisite.RQ_BANK_NAME || "N/A"}
                </p>
                <p>
                  <strong>Account Number:</strong>{" "}
                  {contact.requisite.RQ_ACC_NUM || "N/A"}
                </p>
              </>
            ) : (
              <p>No bank details available for this contact.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NEW ADDITION: Edit and Delete Buttons */}
      <div className="mt-6 flex justify-end space-x-2">
        <Link href={`/contacts/edit/${contactId}`}>
          <Button>Edit Contact</Button>
        </Link>
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Contact"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                contact from Bitrix24 and remove their data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Continue"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ContactDetailPage;
