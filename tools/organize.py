"""Move the extracted TY27 BWC files into named folders with readable file names.

Usage: python3 -I organize.py "<TY27 BWC Source Docs folder>"
Moves files out of <folder>/_extract; prints anything it did not recognize.
"""
import os
import shutil
import sys

R = "00 RESTRICTED - CUI, FOUO, Limited (keep out of app)"
K = "01 Land Nav Course Keys (keep out of app)"
C = "02 Check Markings by Hand"
P = "10 BWC Competitor Packet"
S = "11 MNNG State Policies"
A = "20 Army Regulations and Pamphlets"
D = "21 Doctrine - ADP, FM, ATP"
T = "22 Training Circulars and Soldier Manuals"
M = "30 Camp Ripley Maps and Ranges"
N = "31 Camp Ripley Land Nav Courses"
G = "90 NOT A SOURCE - Gemini Study Guide"

MAP = {
    # Restricted
    "FRAGORD_01_TO_OPORD_JFMN-J3-27-003_(TY27 MNNG BEST WARRIOR COMPETITION).pdf": (R, "FRAGORD 01 to OPORD JFMN-J3-27-003 - TY27 MNNG BWC (CUI).pdf"),
    "OPORD_3427-004_(34ID_TY27_MNNG BEST WARRIOR COMPETITION).docx": (R, "OPORD 3427-004 - 34ID TY27 MNNG BWC (CUI).docx"),
    "Radio Operator's Handbook, QRG 2020 - shrunk.pdf": (R, "Radio Operator's Handbook QRG 2020 (FOUO, Dist C).pdf"),
    "CRTC_MIM_1to50K_NGA_geo.pdf": (R, "Camp Ripley 1-50K NGA Map (Limited Distribution).pdf"),
    # Check by hand
    "MUOS INFO Small File.pdf": (C, "MUOS Info (protected PDF, open in Adobe).pdf"),
    # Competitor packet
    "C_2_A_(TY27 MNNG BWC Competitor MOI).pdf": (P, "TY27 MNNG BWC Competitor MOI (1 Oct 2026).pdf"),
    "C_2_B_(TY27 BWC Competitor MOI Enclosure 1- References).pdf": (P, "TY27 MNNG BWC Competitor MOI - Enclosure - References.pdf"),
    "C_2_C_(TY27 BWC Competitor MOI Enclosure - Packing List).xlsx": (P, "TY27 MNNG BWC Competitor MOI - Enclosure - Packing List.xlsx"),
    "C_2_E_(TY27 BWC Competitor MOI Enclosure 4 - Competitor Biographical Sketch).docx": (P, "TY27 MNNG BWC Competitor MOI - Enclosure 4 - Biographical Sketch.docx"),
    # State policies
    "Drug Testing Policy.pdf": (S, "MNNG Policy - Drug Testing (scanned).pdf"),
    "Equal Opportunity Policy_Military.pdf": (S, "MNNG Policy - Equal Opportunity (Military).pdf"),
    "Harassment Prevention Policy.pdf": (S, "MNNG Policy - Harassment Prevention.pdf"),
    "IG Policy.pdf": (S, "MNNG Policy - Inspector General.pdf"),
    "Improper Relationships Policy.pdf": (S, "MNNG Policy - Improper Relationships.pdf"),
    "Military Justice Policy.pdf": (S, "MNNG Policy - Military Justice.pdf"),
    "Misconduct Reporting Procedures.pdf": (S, "MNNG Policy - Misconduct Reporting Procedures.pdf"),
    "Open Door Policy.pdf": (S, "MNNG Policy - Open Door.pdf"),
    "Sexual Harassment Policy.pdf": (S, "MNNG Policy - Sexual Harassment.pdf"),
    "Social Media Policy.pdf": (S, "MNNG Policy - Social Media.pdf"),
    "Substance Abuse Policy.pdf": (S, "MNNG Policy - Substance Abuse.pdf"),
    # Regulations and pamphlets
    "ARN44161-AR_350-1-001-WEB-2.pdf": (A, "AR 350-1 - Army Training and Leader Development (Jun 2025).pdf"),
    "ARN46390-AR_600-8-22-000-WEB-1.pdf": (A, "AR 600-8-22 - Military Awards (May 2026).pdf"),
    "ARN43120-AR_600-9-001-WEB-3.pdf": (A, "AR 600-9 - The Army Body Composition Program (Jul 2019).pdf"),
    "ARN46266-AR_600-20-000-WEB-1.pdf": (A, "AR 600-20 - Army Command Policy (Apr 2026).pdf"),
    "ARN41373-AR_600-55-000-WEB-1.pdf": (A, "AR 600-55 - Army Driver and Operator Standardization Program (Apr 2025).pdf"),
    "ARN43117-AR_623-3-001-WEB-2.pdf": (A, "AR 623-3 - Evaluation Reporting System (Feb 2025).pdf"),
    "ARN30302-AR_670-1-001-WEB-3.pdf": (A, "AR 670-1 - Wear and Appearance of Army Uniforms and Insignia.pdf"),
    "ARN46195-AR_710-4-000-WEB-1.pdf": (A, "AR 710-4 - Property Accountability (Apr 2026).pdf"),
    "ARN43462-AR_735-5-000-WEB-1.pdf": (A, "AR 735-5 - Relief of Responsibility and Accountability (Apr 2026).pdf"),
    "ARN43006-PAM_623-3-000-WEB-1.pdf": (A, "DA PAM 623-3 - Evaluation Reporting System.pdf"),
    "ARN30948-PAM_670-1-000-WEB-1.pdf": (A, "DA PAM 670-1 - Guide to Wear and Appearance of Army Uniforms and Insignia.pdf"),
    # Doctrine
    "ARN18008-ADP_1-000-WEB-2.pdf": (D, "ADP 1 - The Army.pdf"),
    "ARN47032-ADP_6-0-000-WEB-1.pdf": (D, "ADP 6-0 - Command and Control (Jul 2026).pdf"),
    "ARN42975-ADP_6-22-002-WEB-8.pdf": (D, "ADP 6-22 - Army Leadership and the Profession (C2, Feb 2025).pdf"),
    "ARN40738-ADP_7-0-000-WEB-2.pdf": (D, "ADP 7-0 - Training.pdf"),
    "ARN43687-FM_1-000-WEB-2.pdf": (D, "FM 1 - The Army (Soldier's Book).pdf"),
    "ARN43044-FM_6-22-002-WEB-5.pdf": (D, "FM 6-22 - Developing Leaders (C2, Feb 2025).pdf"),
    "ARN35076-FM_7-0-000-WEB-1.pdf": (D, "FM 7-0 - Training (Jun 2021).pdf"),
    "ARN44522-FM_7-22-002-WEB-7.pdf": (D, "FM 7-22 - Holistic Health and Fitness (C2, Aug 2025).pdf"),
    "ARN5011_ATP 3-09x30 FINAL WEB.pdf": (D, "ATP 3-09.30 - Observed Fires (Sep 2017).pdf"),
    "ARN46159-ATP_4-02.11-000-WEB-1.pdf": (D, "ATP 4-02.11 - Casualty Response, TCCC and First Aid (Mar 2026).pdf"),
    "ARN34181-ATP_5-19-000-WEB-1.pdf": (D, "ATP 5-19 - Risk Management (Nov 2021).pdf"),
    "ARN40232-ATP_6-22.1-000-WEB-1.pdf": (D, "ATP 6-22.1 - Counseling, Coaching, Mentoring (Feb 2024).pdf"),
    # Training circulars and soldier manuals
    "ARN41534-TC_3-11.20-000-WEB-1.pdf": (T, "TC 3-11.20 - CBRN Training Strategies (Jul 2024).pdf"),
    "ARN19574_TC_3-20.40-Incl_C1_FINAL_WEB.pdf": (T, "TC 3-20.40 - Training and Qualification, Individual Weapons (C1).pdf"),
    "NOCASE-TC_3-20.31-1-000-WEB-0.pdf": (T, "TC 3-20.31-1 - Gunnery Skills Test (Govt Only).pdf"),
    "ARN32297-TC_3-21.5-000-WEB-1.pdf": (T, "TC 3-21.5 - Drill and Ceremonies (May 2021).pdf"),
    "tc3_21x75.pdf": (T, "TC 3-21.75 - The Warrior Ethos and Soldier Combat Skills (Aug 2013).pdf"),
    "ARN19927_TC_3-22x9_C3_FINAL_WEB.pdf": (T, "TC 3-22.9 - Rifle and Carbine (C3).pdf"),
    "ARN5846_TC 3-22x50 FINAL WEB.pdf": (T, "TC 3-22.50 - Heavy Machine Gun M2 (May 2017).pdf"),
    "ARN3182-TC_3-22.240-000-WEB-1.pdf": (T, "TC 3-22.240 - Medium Machine Gun M240 (Apr 2017).pdf"),
    "ARN3242-TC_3-22.249-000-WEB-1.pdf": (T, "TC 3-22.249 - Light Machine Gun M249 (May 2017).pdf"),
    "ARN20599_TC_3-23x35_Incl_C2_FINAL_WEB.pdf": (T, "TC 3-23.35 - Pistol (C2).pdf"),
    "ARN43276-TC_3-25.26-000-WEB-0.pdf": (T, "TC 3-25.26 - Map Reading and Land Navigation (Govt Only).pdf"),
    "ARN42780-TC_21-305-3-000-WEB-1.pdf": (T, "TC 21-305-3 - HMMWV Training Program (Govt Only).pdf"),
    "ARN43336-TC_21-305-6-000-WEB-1.pdf": (T, "TC 21-305-6 - FMTV Training Program (Govt Only).pdf"),
    "ARN45313-STP_21-1-SMCT-000-WEB-2.pdf": (T, "STP 21-1-SMCT - Soldier's Manual of Common Tasks, Warrior Skills Level 1 (Govt Only).pdf"),
    "stp21_24.pdf": (T, "STP 21-24-SMCT - Soldier's Manual of Common Tasks, Warrior Leader Skills Levels 2-4 (Sep 2008).pdf"),
    # Camp Ripley maps and ranges
    "CRTC_1to25K_geo.pdf": (M, "Camp Ripley 1-25K Map (GeoPDF).pdf"),
    "CRTC_1to25K_photo_geo.pdf": (M, "Camp Ripley 1-25K Photo Map (GeoPDF).pdf"),
    "210-2_CRTC_Range_Regulation.pdf": (M, "CRTC Reg 210-2 - Camp Ripley Range Regulation (Jan 2026).pdf"),
    "alpha_complex.pdf": (M, "Camp Ripley Ranges - Alpha Complex.pdf"),
    "area10.pdf": (M, "Camp Ripley Ranges - Area 10.pdf"),
    "Mowing Plan Down Range.pdf": (M, "Camp Ripley Training Areas - Mowing Plan Down Range.pdf"),
    "Snow Removal Range Area.pdf": (M, "Camp Ripley Training Areas - Snow Removal Range Area.pdf"),
    # Land nav courses: maps students may see
    "A-11 MAP.pdf": (N, "A-11 Land Nav - Map.pdf"),
    "A-11 Student Map.pdf": (N, "A-11 Land Nav - Student Map.pdf"),
    "B-3 Map.pdf": (N, "B-3 Gettysburg Land Nav - Map.pdf"),
    "B-3 Student Map.pdf": (N, "B-3 Gettysburg Land Nav - Student Map.pdf"),
    "B-3 SOP.docx": (N, "B-3 Gettysburg Land Nav - Course SOP.docx"),
    "B-5 2014_Land_Nav.pdf": (N, "B-5 RTI Land Nav - Map (2014).pdf"),
    "B-7 MAP.pdf": (N, "B-7 Land Nav - Map.pdf"),
    "B-7 Student Map.pdf": (N, "B-7 Land Nav - Student Map.pdf"),
    "B-7 1-25000_2014 Map.pdf": (N, "B-7 Land Nav - 1-25K Map (2014).pdf"),
    "B-7 Aerial.pdf": (N, "B-7 Land Nav - Aerial.pdf"),
    "B-7 Aerial Closeup.pdf": (N, "B-7 Land Nav - Aerial Closeup.pdf"),
    # Land nav courses: answer keys and point grids
    "A-11 Key.pdf": (K, "A-11 Land Nav - Key.pdf"),
    "A-11 Land Nav Key.pdf": (K, "A-11 Land Nav - Key (alternate).pdf"),
    "A-11 Points.xlsx": (K, "A-11 Land Nav - Point Grids.xlsx"),
    "B-3 Key.pdf": (K, "B-3 Gettysburg Land Nav - Key.pdf"),
    "B-3 Points.docx": (K, "B-3 Gettysburg Land Nav - Point Grids.docx"),
    "RTI B-3 Land Nav Points w Grids and Punches.pdf": (K, "B-3 Gettysburg Land Nav - Point Grids and Punches (RTI).pdf"),
    "B-4 Mounted Land Nav Point Key.pdf": (K, "B-4 Mounted Land Nav - Key.pdf"),
    "B-4 Mounted Land Navigation Grids APR14.xlsx": (K, "B-4 Mounted Land Nav - Point Grids (Apr 2014).xlsx"),
    "B-4 Mounted Points List.docx": (K, "B-4 Mounted Land Nav - Points List.docx"),
    "B-5 2014_Land_Nav_Key.pdf": (K, "B-5 RTI Land Nav - Key (2014).pdf"),
    "B-5 Points.docx": (K, "B-5 RTI Land Nav - Point Grids.docx"),
    "B5 Point Locations.pdf": (K, "B-5 RTI Land Nav - Point Locations and Descriptions.pdf"),
    "B-7 Land Nav Key 2016.pdf": (K, "B-7 Land Nav - Key (2016).pdf"),
    "B-7 Points DEC 2015.xlsx": (K, "B-7 Land Nav - Point Grids (Dec 2015).xlsx"),
    "B-7 Points DEC 2015 - Copy.xlsx": (K, "B-7 Land Nav - Point Grids (Dec 2015, second version).xlsx"),
    # Gemini
    "Army_Best_Warrior_Competition_Study_Guide.pdf": (G, "Gemini Study Guide - NOT A SOURCE.pdf"),
}


def main(base):
    src = os.path.join(base, "_extract")
    moved, unknown = 0, []
    for dirpath, _, files in os.walk(src):
        if "__MACOSX" in dirpath:
            continue
        for f in files:
            if f.startswith("."):
                continue
            if f not in MAP:
                unknown.append(os.path.join(dirpath, f))
                continue
            folder, name = MAP[f]
            dest_dir = os.path.join(base, folder)
            os.makedirs(dest_dir, exist_ok=True)
            dest = os.path.join(dest_dir, name)
            if os.path.exists(dest):
                unknown.append(os.path.join(dirpath, f) + "  (destination exists)")
                continue
            shutil.move(os.path.join(dirpath, f), dest)
            moved += 1
    print(f"moved {moved} of {len(MAP)} mapped files")
    for u in unknown:
        print("NOT MOVED:", u)


if __name__ == "__main__":
    main(sys.argv[1])
