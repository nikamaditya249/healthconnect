import Link from "next/link";

export default function PatientCard({ patient }) {
  return (
    <Link
      href={`/patient/${patient._id}`}
      className="block bg-white p-4 rounded shadow hover:bg-gray-50"
    >
      <h2 className="text-xl font-semibold text-black">
        {patient.name}
      </h2>
      <p className="text-black">Age: {patient.age}</p>
      <p className="text-black">Gender: {patient.gender}</p>
    </Link>
  );
}