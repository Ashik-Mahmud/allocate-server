export interface BookingCalendarData {
    date: string,
    day: string,
    availableSlotsCount: number,
    status: string
    slots: {
        start: string,
        end: string,
    }[]
};