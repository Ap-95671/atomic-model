import pygame

from atom import Atom
from elements import ELEMENTS

from physics import (
    print_hydrogen_physics,
    bohr_radius,
    coulomb_force,
    electron_velocity,
    kinetic_energy,
    potential_energy,
    total_energy,
    joules_to_ev
)

from constants import (
    WIDTH,
    HEIGHT,
    BLACK
)


pygame.init()


screen = pygame.display.set_mode(
    (WIDTH, HEIGHT)
)


clock = pygame.time.Clock()


# ------------------------------------------------
# CURRENT ELEMENT
# ------------------------------------------------

current_element = "hydrogen"

atom = Atom(
    ELEMENTS[current_element]
)


# ------------------------------------------------
# WINDOW TITLE
# ------------------------------------------------

def update_window_title():

    pygame.display.set_caption(

        f"Atomic Model Simulator | "
        f"{atom.name} ({atom.symbol}) | "
        f"p+: {atom.protons} | "
        f"n: {atom.neutrons} | "
        f"e-: {atom.electron_count}"

    )


# ------------------------------------------------
# ELEMENT INFORMATION
# ------------------------------------------------

def print_atom_information():

    print()
    print("=" * 50)

    print(
        f"{atom.name.upper()} "
        f"({atom.symbol})"
    )

    print("=" * 50)

    print(
        f"Atomic Number: "
        f"{atom.atomic_number}"
    )

    print(
        f"Protons:       "
        f"{atom.protons}"
    )

    print(
        f"Neutrons:      "
        f"{atom.neutrons}"
    )

    print(
        f"Electrons:     "
        f"{atom.electron_count}"
    )

    print(
        f"Configuration: "
        f"{atom.electron_configuration}"
    )

    print("=" * 50)


# ------------------------------------------------
# CHANGE ELEMENT
# ------------------------------------------------

def select_element(name):

    global atom
    global current_element

    current_element = name

    atom = Atom(
        ELEMENTS[current_element]
    )

    update_window_title()

    print_atom_information()


# ------------------------------------------------
# STARTUP
# ------------------------------------------------

update_window_title()

print()
print("ATOMIC MODEL SIMULATOR")
print("======================")
print()

print("CONTROLS")
print("----------------------")

print("1  = Hydrogen")
print("2  = Helium")
print("3  = Lithium")

print()

print("P  = Physics information")
print("ESC = Exit")

print()

print_atom_information()


# ------------------------------------------------
# MAIN LOOP
# ------------------------------------------------

running = True


while running:

    for event in pygame.event.get():

        if event.type == pygame.QUIT:

            running = False


        if event.type == pygame.KEYDOWN:

            # ------------------------------------
            # EXIT
            # ------------------------------------

            if event.key == pygame.K_ESCAPE:

                running = False


            # ------------------------------------
            # HYDROGEN
            # ------------------------------------

            elif event.key == pygame.K_1:

                select_element(
                    "hydrogen"
                )


            # ------------------------------------
            # HELIUM
            # ------------------------------------

            elif event.key == pygame.K_2:

                select_element(
                    "helium"
                )


            # ------------------------------------
            # LITHIUM
            # ------------------------------------

            elif event.key == pygame.K_3:

                select_element(
                    "lithium"
                )


            # ------------------------------------
            # PHYSICS
            # ------------------------------------

            elif event.key == pygame.K_p:

                if current_element == "hydrogen":

                    print_hydrogen_physics()

                else:

                    print()

                    print(
                        "Detailed Bohr physics is "
                        "currently implemented only "
                        "for Hydrogen."
                    )

                    print(
                        "Multi-electron atoms require "
                        "electron-electron interactions "
                        "and quantum mechanics."
                    )

                    print()


    # ------------------------------------------------
    # DRAWING
    # ------------------------------------------------

    screen.fill(
        BLACK
    )


    atom.update()


    atom.draw(
        screen
    )


    pygame.display.flip()


    clock.tick(
        60
    )


pygame.quit()