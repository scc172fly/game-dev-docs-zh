"""Run native conflict probes with cl (Developer Command Prompt), clang++ or g++."""

import argparse
from pathlib import Path
import os
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("r1117", type=Path)
parser.add_argument(
    "--compiler", default=os.environ.get("CXX", "cl" if os.name == "nt" else "c++")
)
args = parser.parse_args()
src = args.r1117 / "Src/PF_GameLogic"
methods = {
    "PFBaseUnitAppl.cpp": ["void PFBaseUnit::EventHappened("],
    "PFApplicator.cpp": [
        "void PFBaseApplicator::Block()",
        "void PFBaseApplicator::Unblock()",
    ],
    "PFApplBuff.cpp": [
        "bool PFApplBuff::NeedToStopOnDeath()",
        "bool PFApplBuff::NeedToStopOnSenderDeath()",
        "bool PFApplBuff::NeedToDisableOnDeath()",
        "bool PFApplBuff::GetRemainingLifeTime(",
        "bool PFApplBuff::Step(",
    ],
    "PFApplMod.cpp": [
        "void PFApplStatus::CompareByPower(",
        "void PFApplStatus::MergeByValue()",
        "void PFApplStatus::Stop()",
        "void PFApplStatus::ForceUpdateLifetime(",
    ],
}
with tempfile.TemporaryDirectory() as directory:
    build = Path(directory)
    with (build / "engine_fragments.inc").open("w", encoding="utf8") as out:
        for filename, signatures in methods.items():
            source = (src / filename).read_text(encoding="cp1251")
            for signature in signatures:
                start = source.index(signature)
                # r1117 uses a column-zero closing brace for these top-level definitions.
                end = source.index("\n}", source.index("{", start)) + 2
                out.write(source[start:end] + "\n")
    stacking = (src / "PFApplMod.cpp").read_text(encoding="cp1251")
    begin = stacking.index(
        "if ( pAppl->GetDB().GetDBID() == pNewcomer->GetDB().GetDBID() )"
    )
    end = stacking.index("else if ( IsInList(", begin)
    (build / "same_db_branch.inc").write_text(stacking[begin:end], encoding="utf8")
    header = (src / "PFApplicator.h").read_text(encoding="cp1251")
    begin = header.index(
        "template <class R, class F> static void ForallRingSafe(R &applicators, F &f)"
    )
    end = header.index("\n  }", begin) + len("\n  }")
    (build / "step_order.inc").write_text(header[begin:end], encoding="utf8")
    events = (src / "PFBaseUnitAppl.cpp").read_text(encoding="cp1251")
    begin = events.index("struct StopAndDeleteApplicator_")
    end = events.index("struct DeleteAppliedApplicator_", begin)
    (build / "death_callbacks.inc").write_text(events[begin:end], encoding="utf8")
    begin = events.index(
        "struct PosFinder", events.index("void PFBaseUnit::AddEventListener")
    )
    end = events.index("} listenerPosFinder", begin) + 1
    (build / "listener_order.inc").write_text(events[begin:end] + ";", encoding="utf8")
    world = (src.parent / "PF_Core/World.cpp").read_text(encoding="cp1251")

    def fragment(name, start, end, offset=0):
        first = world.index(start, offset)
        last = world.index(end, first)
        (build / name).write_text(world[first:last], encoding="utf8")

    fragment(
        "world_step.inc",
        "bool World::Step(float dtInSeconds",
        "int World::GetStepLength()",
    )
    fragment(
        "world_subscribe.inc",
        "void World::SubscribeObject(",
        "void World::UnsubscribeObject(",
    )
    fragment(
        "world_register.inc",
        "if (immediately)",
        "WORLD_OBJECTS_CHECK_LIST_ADD",
        world.index("void World::RegisterObject("),
    )
    fragment(
        "world_pending.inc",
        "for (ring::Range<WorldObjectBase::Ring> it(addedObjects)",
        "// apply removed objects",
        world.index("bool World::ProcessAddRemove()"),
    )
    strike = (src / "PFDispatchStrike1.cpp").read_text(encoding="cp1251")
    start = strike.index("void PFDispatchImmediate::OnStart()")
    end = strike.index("PFDispatchContinuous::PFDispatchContinuous", start)
    (build / "immediate_step.inc").write_text(strike[start:end], encoding="utf8")
    with (build / "retry_methods.inc").open("w", encoding="utf8") as out:
        for filename, signature in [
            ("PFAbilityData.cpp", "bool PFAbilityData::IsTargetValid("),
            ("PFDispatch.cpp", "void PFDispatch::_ApplyInternal()"),
            ("PFDispatch.cpp", "bool PFDispatch::Step("),
        ]:
            source = (src / filename).read_text(encoding="cp1251")
            begin = source.index(signature)
            end = source.index("\n}", begin) + 2
            out.write(source[begin:end] + "\n")
    start = events.index("PFBaseUnitApplicatorAppliedEvent evtApplicator")
    end = events.index("// Start applicator", start)
    (build / "single_effect_veto.inc").write_text(events[start:end], encoding="utf8")
    program = (src / "PFApplSpecial.cpp").read_text(encoding="cp1251")
    begin = program.index("bool PFApplProgram::ExecuteNext()")
    end = program.index("bool PFApplProgram::IsFinished()", begin)
    (build / "program_methods.inc").write_text(program[begin:end], encoding="utf8")
    begin = program.index("bool PFApplProgram::Step(")
    end = program.index("\n}", begin) + 2
    (build / "program_tick.inc").write_text(program[begin:end], encoding="utf8")
    from delay_notification import SCENARIOS

    with (build / "delay_cases.inc").open("w", encoding="utf8") as out:
        for case in SCENARIOS:
            out.write(
                f"{{{case.mask},{case.note},{int(case.before_tick)},{int(case.overdue)},{case.read_tick}}},\n"
            )
    unit = Path(__file__).with_name("status_conflict_probe.cpp").resolve()
    binary = build / ("probe.exe" if os.name == "nt" else "probe")
    compiler = shutil.which(args.compiler)
    if not compiler:
        parser.error(f"{args.compiler} not found on PATH")
    if Path(compiler).stem.lower() in ("cl", "clang-cl"):
        options = [
            "/nologo",
            "/EHsc",
            "/std:c++17",
            f"/I{build}",
            str(unit),
            f"/Fe:{binary}",
        ]
    else:
        options = ["-std=c++17", "-I", str(build), str(unit), "-o", str(binary)]
    subprocess.run([compiler, *options], cwd=build, check=True)
    subprocess.run([str(binary)], check=True)
