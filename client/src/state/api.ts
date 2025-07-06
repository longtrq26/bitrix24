import { Contact, GetContactsResponse } from "@/types";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }),
  tagTypes: ["Contacts", "ContactDetails"],

  endpoints: (builder) => ({
    // Lấy danh sách contact
    getContacts: builder.query<
      GetContactsResponse,
      { memberId: string; page?: number; limit?: number; search?: string }
    >({
      query: ({ memberId, page = 0, limit = 10, search }) => {
        const params = new URLSearchParams({
          memberId,
          page: page.toString(),
          limit: limit.toString(),
        });

        if (search) params.append("search", search);

        return `contacts?${params.toString()}`;
      },
      providesTags: ["Contacts"],
    }),

    // Lấy chi tiết contact
    getContactDetails: builder.query<
      Contact,
      { memberId: string; contactId: string }
    >({
      query: ({ memberId, contactId }) => {
        const params = new URLSearchParams({ memberId });
        return `contacts/${contactId}?${params.toString()}`;
      },

      providesTags: (_result, _error, { contactId }) => [
        { type: "ContactDetails", id: contactId },
      ],
    }),

    // Tạo contact mới
    createContact: builder.mutation<
      { id: string; message: string },
      { memberId: string; data: any }
    >({
      query: ({ memberId, data }) => ({
        url: `contacts?memberId=${memberId}`,
        method: "POST",
        body: data,
      }),

      invalidatesTags: ["Contacts"],
    }),

    // Cập nhật contact
    updateContact: builder.mutation<
      { message: string },
      { memberId: string; contactId: string; data: any }
    >({
      query: ({ memberId, contactId, data }) => ({
        url: `contacts/${contactId}?memberId=${memberId}`,
        method: "PUT",
        body: data,
      }),

      invalidatesTags: (_result, _error, { contactId }) => [
        { type: "ContactDetails", id: contactId },
        "Contacts",
      ],
    }),

    // Xóa contact
    deleteContact: builder.mutation<
      { message: string },
      { memberId: string; contactId: string }
    >({
      query: ({ memberId, contactId }) => ({
        url: `contacts/${contactId}?memberId=${memberId}`,
        method: "DELETE",
      }),

      invalidatesTags: (_result, _error, { contactId }) => [
        "Contacts",
        { type: "ContactDetails", id: contactId },
      ],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetContactDetailsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
} = api;
