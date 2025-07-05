// src/app/contacts/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGetContactsQuery } from "@/state/api";
// CORRECTED IMPORT PATH:
import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react"; // Keep for type checking
import Link from "next/link";
import React, { useState } from "react";

const ContactsPage = () => {
  // IMPORTANT: This memberId is currently hardcoded. In a real application,
  // this should come from your authentication system (e.g., user session, context, etc.).
  const [memberId, setMemberId] = useState("e3b04fcf454a94d025ceb96c93423068");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [limit] = useState(50); // Hardcoded limit, can be made dynamic later

  // Fetch contacts using RTK Query hook
  const { data, error, isLoading, isFetching, refetch } = useGetContactsQuery(
    { memberId, page, limit, search: searchQuery },
    { skip: !memberId } // Skip fetching if memberId is not set
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(0); // Reset page to 0 when search query changes
  };

  // Handle pagination
  const handleNextPage = () => {
    // Ensure data and total are available before calculating next page
    if (data?.total !== undefined && (page + 1) * limit < data.total) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    setPage((prev) => Math.max(0, prev - 1));
  };

  // --- Render based on loading/error states ---
  if (!memberId) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Contacts</h1>
        <p>
          Please provide a member ID to load contacts (e.g., through an
          authentication flow).
        </p>
      </div>
    );
  }

  if (isLoading && !isFetching) {
    // Initial load, not refetching
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Contacts</h1>
        <p>Loading contacts...</p>
      </div>
    );
  }

  if (error) {
    let errorMessage = "An unknown error occurred";

    if ("status" in error) {
      // This is a FetchBaseQueryError
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
      // This is a SerializedError
      errorMessage = error.message as string;
    }

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Contacts</h1>
        <p className="text-red-500">Error loading contacts: {errorMessage}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const contacts = data?.data || [];
  const totalContacts = data?.total || 0;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Bitrix24 Contacts</h1>

      <div className="flex justify-between items-center mb-4">
        <Input
          type="text"
          placeholder="Search contacts by name..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
        <Link href="/contacts/new">
          <Button>Add New Contact</Button>
        </Link>
      </div>

      {isFetching && (
        <p className="text-sm text-gray-500 mb-2">Refreshing data...</p>
      )}

      {contacts.length === 0 && !isLoading && !isFetching ? (
        <p className="text-center text-gray-600">No contacts found.</p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact: any) => (
                <TableRow key={contact.ID}>
                  <TableCell className="font-medium">
                    {contact.NAME} {contact.LAST_NAME}
                  </TableCell>
                  <TableCell>
                    {contact.EMAIL && contact.EMAIL.length > 0
                      ? contact.EMAIL[0].VALUE
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {contact.PHONE && contact.PHONE.length > 0
                      ? contact.PHONE[0].VALUE
                      : "N/A"}
                  </TableCell>
                  <TableCell>{contact.ADDRESS_CITY || "N/A"}</TableCell>
                  <TableCell className="text-right flex justify-end space-x-2">
                    <Link href={`/contacts/${contact.ID}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    {/* NEW ADDITION: Edit button */}
                    <Link href={`/contacts/edit/${contact.ID}`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-between items-center mt-4">
        <Button
          onClick={handlePrevPage}
          disabled={page === 0 || isLoading || isFetching}
        >
          Previous
        </Button>
        <span>
          Page {page + 1} of {Math.ceil(totalContacts / limit)} ({totalContacts}{" "}
          contacts)
        </span>
        <Button
          onClick={handleNextPage}
          disabled={
            (page + 1) * limit >= totalContacts || isLoading || isFetching
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default ContactsPage;
