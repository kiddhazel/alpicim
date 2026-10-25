// Release derlemesinde Windows'ta ek konsol penceresi açılmasını engeller.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    alpicim_lib::run()
}
